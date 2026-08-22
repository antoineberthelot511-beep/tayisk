-- Opinion Cards — schema Postgres / Supabase
-- A executer dans le SQL Editor du projet Supabase.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- types

do $$ begin
  create type statement_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vote_choice as enum ('agree', 'disagree');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- tables

create table if not exists public.statements (
  id                uuid primary key default gen_random_uuid(),
  text              text not null check (char_length(text) between 3 and 200),
  text_language     varchar(5) not null default 'fr',
  translations      jsonb not null default '{}'::jsonb,
  image_url         text,
  image_keyword     text,
  created_by        uuid references auth.users (id) on delete set null,
  status            statement_status not null default 'pending',
  moderation_result jsonb,
  votes_agree       int not null default 0,
  votes_disagree    int not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  device_id    text not null,
  vote         vote_choice not null,
  created_at   timestamptz not null default now(),
  -- Un seul vote par carte et par device : c'est ce qui rend cast_vote idempotent.
  unique (statement_id, device_id)
);

create index if not exists statements_status_created_idx
  on public.statements (status, created_at desc);
create index if not exists votes_device_idx on public.votes (device_id);
create index if not exists votes_statement_idx on public.votes (statement_id);

-- ---------------------------------------------------------------- RLS
-- Toutes les ecritures passent par les routes API (service role), qui
-- contourne RLS. L'anon ne peut que lire les cartes approuvees.

alter table public.statements enable row level security;
alter table public.votes enable row level security;

drop policy if exists "lecture publique des cartes approuvees" on public.statements;
create policy "lecture publique des cartes approuvees"
  on public.statements for select
  using (status = 'approved');

drop policy if exists "lecture publique des votes" on public.votes;
create policy "lecture publique des votes"
  on public.votes for select
  using (true);

-- ------------------------------------------------- compteurs (trigger)
-- Les colonnes votes_agree / votes_disagree sont maintenues par ce trigger,
-- et par lui seul : peu importe que le vote arrive de l'app, du RPC ou d'un
-- INSERT manuel, le total reste juste et l'increment reste atomique.
-- L'application ne doit donc JAMAIS incrementer ces colonnes elle-meme.

create or replace function public.votes_sync_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.statements
       set votes_agree    = votes_agree + (new.vote = 'agree')::int,
           votes_disagree = votes_disagree + (new.vote = 'disagree')::int
     where id = new.statement_id;
  elsif tg_op = 'DELETE' then
    update public.statements
       set votes_agree    = greatest(0, votes_agree - (old.vote = 'agree')::int),
           votes_disagree = greatest(0, votes_disagree - (old.vote = 'disagree')::int)
     where id = old.statement_id;
  end if;
  return null;
end;
$$;

-- Retire les eventuels triggers deja poses sur `votes` avant de recreer le
-- notre : sans ca, rejouer ce fichier sur une base existante empilerait deux
-- triggers et chaque vote compterait double.
do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
     where tgrelid = 'public.votes'::regclass and not tgisinternal
  loop
    execute format('drop trigger %I on public.votes', t.tgname);
  end loop;
end $$;

create trigger votes_sync_counters
  after insert or delete on public.votes
  for each row execute function public.votes_sync_counters();

-- ---------------------------------------------------------------- RPC

-- Enregistre un vote et renvoie les totaux a jour (le trigger ci-dessus a
-- deja mis les compteurs a jour dans la meme transaction), plus un drapeau
-- indiquant si ce device avait deja vote sur cette carte.
create or replace function public.cast_vote(
  p_statement_id uuid,
  p_device_id    text,
  p_vote         vote_choice,
  p_user_id      uuid default null
)
returns table (
  out_agree    int,
  out_disagree int,
  out_already  boolean,
  out_vote     vote_choice
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows      int;
  v_effective vote_choice;
begin
  insert into public.votes (statement_id, device_id, vote, user_id)
  values (p_statement_id, p_device_id, p_vote, p_user_id)
  on conflict (statement_id, device_id) do nothing;

  get diagnostics v_rows = row_count;

  -- En cas de revote, c'est le vote deja enregistre qui fait foi : le message
  -- majorite/minorite doit refleter le camp reel de l'utilisateur.
  select v.vote into v_effective
    from public.votes v
   where v.statement_id = p_statement_id
     and v.device_id = p_device_id;

  return query
    select s.votes_agree, s.votes_disagree, v_rows = 0, v_effective
      from public.statements s
     where s.id = p_statement_id;
end;
$$;

-- Cartes approuvees sur lesquelles ce device n'a pas encore vote.
-- order by random() convient tant que la table reste petite (< quelques
-- milliers de lignes) ; a remplacer par un echantillonnage si ca grossit.
create or replace function public.feed_statements(
  p_device_id text,
  p_limit     int default 10
)
returns setof public.statements
language sql
stable
security definer
set search_path = public
as $$
  select s.*
    from public.statements s
   where s.status = 'approved'
     and not exists (
       select 1 from public.votes v
        where v.statement_id = s.id
          and v.device_id = p_device_id
     )
   order by random()
   limit greatest(1, least(p_limit, 30));
$$;

-- ---------------------------------------------------------------- seed

insert into public.statements (text, text_language, translations, image_url, image_keyword, status)
values
  ('Mettre de l''ananas sur une pizza est un crime.', 'fr',
   '{"fr":"Mettre de l''ananas sur une pizza est un crime.","en":"Putting pineapple on pizza is a crime.","es":"Poner pina en la pizza es un crimen."}'::jsonb,
   'https://picsum.photos/seed/pizza/800/1200', 'pizza', 'approved'),
  ('On devrait travailler 4 jours par semaine.', 'fr',
   '{"fr":"On devrait travailler 4 jours par semaine.","en":"We should work four days a week.","es":"Deberiamos trabajar cuatro dias a la semana."}'::jsonb,
   'https://picsum.photos/seed/work/800/1200', 'office', 'approved'),
  ('Les chats sont meilleurs que les chiens.', 'fr',
   '{"fr":"Les chats sont meilleurs que les chiens.","en":"Cats are better than dogs.","es":"Los gatos son mejores que los perros."}'::jsonb,
   'https://picsum.photos/seed/cat/800/1200', 'cat', 'approved')
on conflict do nothing;
