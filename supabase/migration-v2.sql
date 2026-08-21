-- ============================================
-- Migration V2 — à exécuter dans le SQL Editor Supabase
-- ============================================

-- 1. Catégories
create type statement_category as enum ('societe','politique','culture','quotidien','travail','relations','autre');
alter table public.statements add column if not exists category statement_category not null default 'autre';

-- 2. Score de controverse (0 = consensus, 100 = 50/50 parfait) + chemin storage
alter table public.statements add column if not exists controversy_score float not null default 0;
alter table public.statements add column if not exists image_storage_path text;

-- Recalcul automatique après chaque vote
create or replace function public.update_controversy()
returns trigger as $$
declare
  a int; d int; total int; ratio float; new_controversy float;
begin
  select votes_agree, votes_disagree into a, d from public.statements where id = new.statement_id;
  total := a + d;
  if total > 0 then
    ratio := least(a, d)::float / total;
    -- controverse max quand 50/50 ; pondérée par le volume de votes
    new_controversy := round((100 * ratio * least(total::float / 20, 1))::numeric, 2);
    update public.statements set controversy_score = new_controversy where id = new.statement_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_controversy on public.votes;
create trigger trg_controversy
  after insert on public.votes
  for each row execute function public.update_controversy();

-- Backfill sur les données existantes
update public.statements set
  controversy_score = round((100 * least(votes_agree, votes_disagree)::float /
    greatest(votes_agree + votes_disagree, 1) * least((votes_agree + votes_disagree)::float / 20, 1))::numeric, 2);

-- 3. Profils (streak + rôle admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  streak_count int not null default 0,
  last_vote_date date,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- 4. Limites quotidiennes (anti-abus)
create table if not exists public.daily_limits (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  day date not null default current_date,
  statements_created_count int not null default 0,
  unique (device_id, day)
);
alter table public.daily_limits enable row level security;
create policy "service role only" on public.daily_limits for all using (true) with check (true);

-- 5. Storage : bucket images publiques
insert into storage.buckets (id, name, public) values ('statement-images', 'statement-images', true)
on conflict (id) do nothing;
create policy "public read images" on storage.objects for select using (bucket_id = 'statement-images');

-- Index tendances
create index if not exists idx_statements_controversy on public.statements (controversy_score desc);
create index if not exists idx_votes_created_at on public.votes (created_at desc);

-- RPC anti-abus : incrémente le compteur quotidien (atomique)
create or replace function public.upsert_daily_limit(p_device_id text)
returns void as $$
begin
  insert into public.daily_limits (device_id, day, statements_created_count)
  values (p_device_id, current_date, 1)
  on conflict (device_id, day)
  do update set statements_created_count = public.daily_limits.statements_created_count + 1;
end;
$$ language plpgsql security definer;

-- Streak : met à jour la série de jours consécutifs de vote
create or replace function public.update_streak(p_user_id uuid)
returns void as $$
declare
  last_date date;
begin
  select last_vote_date into last_date from public.profiles where id = p_user_id;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    insert into public.profiles (id, streak_count, last_vote_date) values (p_user_id, 1, current_date);
  elsif last_date = current_date then
    null; -- déjà voté aujourd'hui
  elsif last_date = current_date - 1 then
    update public.profiles set streak_count = streak_count + 1, last_vote_date = current_date where id = p_user_id;
  else
    update public.profiles set streak_count = 1, last_vote_date = current_date where id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

