-- ============================================
-- Opinion Cards — Schéma Supabase / Postgres
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

create extension if not exists "pgcrypto";

-- Types énumérés
create type statement_status as enum ('pending', 'approved', 'rejected');
create type vote_type as enum ('agree', 'disagree');

-- Table statements
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) <= 280),
  text_language varchar(5) not null default 'fr',
  translations jsonb not null default '{}'::jsonb,
  image_url text,
  image_keyword text,
  created_by uuid references auth.users(id) on delete set null,
  status statement_status not null default 'pending',
  moderation_result jsonb,
  votes_agree int not null default 0,
  votes_disagree int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_statements_status_created on public.statements (status, created_at desc);

-- Table votes
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_id text not null,
  vote vote_type not null,
  created_at timestamptz not null default now(),
  unique (statement_id, device_id)
);

create index if not exists idx_votes_device on public.votes (device_id);

-- ============================================
-- Trigger : compteurs de votes (atomique)
-- ============================================
create or replace function public.handle_vote_counters()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.statements
      set votes_agree = votes_agree + (case when new.vote = 'agree' then 1 else 0 end),
          votes_disagree = votes_disagree + (case when new.vote = 'disagree' then 1 else 0 end)
      where id = new.statement_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update public.statements
      set votes_agree = greatest(votes_agree - (case when old.vote = 'agree' then 1 else 0 end), 0),
          votes_disagree = greatest(votes_disagree - (case when old.vote = 'disagree' then 1 else 0 end), 0)
      where id = old.statement_id;
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_vote_counters on public.votes;
create trigger trg_vote_counters
  after insert or delete on public.votes
  for each row execute function public.handle_vote_counters();

-- ============================================
-- Row Level Security
-- ============================================
alter table public.statements enable row level security;
alter table public.votes enable row level security;

-- Lecture publique des cartes approuvées
create policy "read approved statements" on public.statements
  for select using (status = 'approved');

-- Les utilisateurs connectés voient leurs propres cartes (tous statuts)
create policy "read own statements" on public.statements
  for select using (auth.uid() = created_by);

-- Insertion : tout le monde (anonyme inclus), statut forcé côté serveur
create policy "insert statements" on public.statements
  for insert with check (true);

-- Votes : insertion publique (device_id), pas de modification/suppression
create policy "insert votes" on public.votes
  for insert with check (true);

create policy "read votes" on public.votes
  for select using (true);

-- ============================================
-- Données de test (seed)
-- ============================================
insert into public.statements (text, text_language, translations, status, image_keyword, votes_agree, votes_disagree) values
  ('Le télétravail améliore la qualité de vie.', 'fr', '{"en":"Remote work improves quality of life.","es":"El trabajo remoto mejora la calidad de vida."}', 'approved', 'remote work', 78, 22),
  ('Les réseaux sociaux font plus de mal que de bien.', 'fr', '{"en":"Social media does more harm than good.","es":"Las redes sociales hacen más daño que bien."}', 'approved', 'social media', 64, 36),
  ('Voyager seul est la meilleure façon de grandir.', 'fr', '{"en":"Traveling alone is the best way to grow.","es":"Viajar solo es la mejor manera de crecer."}', 'approved', 'travel', 81, 19),
  ('L''intelligence artificielle créera plus d''emplois qu''elle n''en détruira.', 'fr', '{"en":"AI will create more jobs than it destroys.","es":"La IA creará más empleos de los que destruirá."}', 'approved', 'artificial intelligence', 35, 65),
  ('Il faudrait interdire les voitures en centre-ville.', 'fr', '{"en":"Cars should be banned from city centers.","es":"Deberían prohibirse los coches en el centro de la ciudad."}', 'approved', 'city street', 52, 48),
  ('Le café est supérieur au thé.', 'fr', '{"en":"Coffee is superior to tea.","es":"El café es superior al té."}', 'approved', 'coffee', 70, 30);
