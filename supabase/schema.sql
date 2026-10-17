-- =====================================================================
--  Plateforme Ayesha — structure de la base Supabase
--  À coller en entier dans Supabase › SQL Editor › New query, puis « Run ».
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- ---------- Profils : un par compte Discord connecté ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         text not null default 'joueur' check (role in ('joueur', 'mj')),
  created_at   timestamptz not null default now()
);

-- ---------- Personnages : un seul par joueur ----------
create table if not exists public.characters (
  owner      uuid primary key references public.profiles (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Le joueur connecté est-il MJ ? ----------
create or replace function public.is_mj()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'mj');
$$;

-- ---------- Création automatique du profil à la première connexion ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
             new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Date de mise à jour gérée par la base ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before insert or update on public.characters
  for each row execute function public.touch_updated_at();

-- ---------- Un joueur ne peut pas se donner le rôle de MJ ----------
create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_mj() then
    if tg_op = 'INSERT' then new.role := 'joueur';
    elsif new.role is distinct from old.role then new.role := old.role;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before insert or update on public.profiles
  for each row execute function public.protect_role();

-- ---------- Règles d'accès (RLS) ----------
alter table public.profiles   enable row level security;
alter table public.characters enable row level security;

drop policy if exists "profil : lire le sien ou MJ"   on public.profiles;
drop policy if exists "profil : créer le sien"        on public.profiles;
drop policy if exists "profil : modifier le sien"     on public.profiles;
create policy "profil : lire le sien ou MJ" on public.profiles
  for select using (id = auth.uid() or public.is_mj());
create policy "profil : créer le sien" on public.profiles
  for insert with check (id = auth.uid());
create policy "profil : modifier le sien" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "fiche : lire la sienne ou MJ"  on public.characters;
drop policy if exists "fiche : créer la sienne"       on public.characters;
drop policy if exists "fiche : modifier la sienne"    on public.characters;
drop policy if exists "fiche : supprimer la sienne"   on public.characters;
create policy "fiche : lire la sienne ou MJ" on public.characters
  for select using (owner = auth.uid() or public.is_mj());
create policy "fiche : créer la sienne" on public.characters
  for insert with check (owner = auth.uid());
create policy "fiche : modifier la sienne" on public.characters
  for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "fiche : supprimer la sienne" on public.characters
  for delete using (owner = auth.uid());

-- ---------- Maintien en éveil ----------
-- Supabase met en pause un projet gratuit resté inactif une semaine.
-- Le workflow GitHub .github/workflows/keepalive.yml appelle cette fonction tous les 2 jours.
create table if not exists public.keepalive (
  id        int primary key default 1 check (id = 1),
  last_ping timestamptz not null default now(),
  pings     bigint not null default 0
);
insert into public.keepalive (id) values (1) on conflict (id) do nothing;
alter table public.keepalive enable row level security;   -- aucune règle : inaccessible directement

create or replace function public.keepalive()
returns timestamptz language sql security definer set search_path = public as $$
  update public.keepalive set last_ping = now(), pings = pings + 1 where id = 1 returning last_ping;
$$;
grant execute on function public.keepalive() to anon, authenticated;

-- =====================================================================
--  DEVENIR MJ — à faire UNE fois, après votre première connexion au site :
--  remplacez le pseudo, puis exécutez seulement cette ligne.
--
--  update public.profiles set role = 'mj' where display_name = 'VotrePseudoDiscord';
--
--  Pour vérifier :  select display_name, role from public.profiles;
-- =====================================================================
