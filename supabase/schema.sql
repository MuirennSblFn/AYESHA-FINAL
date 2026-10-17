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

-- =====================================================================
--  ARMURERIE : catalogue, comptes en banque, achats
--  Les montants sont en centimes d'euro (1250 = 12,50 €).
-- =====================================================================

-- ---------- Catalogue (géré par le MJ depuis le site) ----------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  categorie   text not null check (categorie in ('arme', 'armure', 'consommable', 'artefact', 'equipement')),
  prix        bigint not null default 0 check (prix >= 0),
  description text not null default '',
  stat        text not null default 'FOR',   -- armes : caractéristique testée
  degats      text not null default '',      -- armes
  reduction   text not null default '',      -- armures
  malus       text not null default '',      -- armures : malus de DEX
  effets      text not null default '',
  visible     boolean not null default true, -- masqué = invisible pour les joueurs
  created_at  timestamptz not null default now()
);
alter table public.items enable row level security;
drop policy if exists "catalogue : lire"        on public.items;
drop policy if exists "catalogue : gérer (MJ)"  on public.items;
create policy "catalogue : lire" on public.items
  for select using (visible or public.is_mj());
create policy "catalogue : gérer (MJ)" on public.items
  for all using (public.is_mj()) with check (public.is_mj());

-- ---------- Relevé de compte : une ligne par mouvement ----------
-- Aucune écriture directe : uniquement via les fonctions mouvement() et acheter().
create table if not exists public.transactions (
  id         bigint generated always as identity primary key,
  owner      uuid not null references public.profiles (id) on delete cascade,
  montant    bigint not null,                 -- positif = crédit, négatif = débit
  motif      text not null default '',
  item_id    uuid references public.items (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists transactions_owner on public.transactions (owner, created_at desc);
alter table public.transactions enable row level security;
drop policy if exists "relevé : lire le sien ou MJ" on public.transactions;
create policy "relevé : lire le sien ou MJ" on public.transactions
  for select using (owner = auth.uid() or public.is_mj());

-- ---------- MJ : créditer ou retirer de l'argent ----------
create or replace function public.mouvement(p_joueur uuid, p_montant bigint, p_motif text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_solde bigint;
begin
  if not public.is_mj() then raise exception 'Seul le MJ peut créditer ou débiter un compte.'; end if;
  if p_montant = 0 then raise exception 'Le montant ne peut pas être nul.'; end if;
  if not exists (select 1 from profiles where id = p_joueur) then raise exception 'Joueur introuvable.'; end if;
  insert into transactions (owner, montant, motif) values (p_joueur, p_montant, coalesce(nullif(trim(p_motif), ''), case when p_montant > 0 then 'Crédit du MJ' else 'Retrait du MJ' end));
  select coalesce(sum(montant), 0) into v_solde from transactions where owner = p_joueur;
  return v_solde;
end $$;
grant execute on function public.mouvement(uuid, bigint, text) to authenticated;

-- ---------- Joueur : acheter (vérifie le solde, débite et ajoute à la fiche d'un seul coup) ----------
create or replace function public.acheter(p_item uuid, p_qte int default 1)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_it items%rowtype;
  v_qte int;
  v_total bigint;
  v_solde bigint;
  v_data jsonb;
  v_objs jsonb;
  v_idx int;
  v_old text;
begin
  if v_uid is null then raise exception 'Connectez-vous pour acheter.'; end if;
  perform pg_advisory_xact_lock(hashtext('achat-' || v_uid::text));   -- un achat à la fois par joueur

  select * into v_it from items where id = p_item and visible;
  if not found then raise exception 'Cet objet n''est plus disponible.'; end if;

  v_qte := case when v_it.categorie in ('arme', 'armure') then 1 else greatest(1, least(coalesce(p_qte, 1), 99)) end;
  v_total := v_it.prix * v_qte;

  select data into v_data from characters where owner = v_uid for update;
  if not found then raise exception 'Créez d''abord votre fiche de personnage.'; end if;

  select coalesce(sum(montant), 0) into v_solde from transactions where owner = v_uid;
  if v_solde < v_total then raise exception 'Solde insuffisant.'; end if;

  insert into transactions (owner, montant, motif, item_id)
  values (v_uid, -v_total, 'Achat : ' || v_it.nom || case when v_qte > 1 then ' ×' || v_qte else '' end, v_it.id);

  -- Ajout à la fiche
  if v_it.categorie = 'arme' then
    v_data := jsonb_set(v_data, '{armes}', coalesce(v_data -> 'armes', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'nom', v_it.nom, 'stat', v_it.stat, 'deg', v_it.degats, 'eff', v_it.effets, 'src', 'armurerie')));
  elsif v_it.categorie = 'armure' then
    v_data := jsonb_set(v_data, '{armures}', coalesce(v_data -> 'armures', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'nom', v_it.nom, 'red', v_it.reduction, 'mal', v_it.malus, 'eff', v_it.effets, 'src', 'armurerie')));
  else
    v_objs := coalesce(v_data -> 'objets', '[]'::jsonb);
    select (ord - 1)::int into v_idx from jsonb_array_elements(v_objs) with ordinality e(v, ord) where v ->> 'item' = v_it.id::text limit 1;
    if v_idx is null then
      v_objs := v_objs || jsonb_build_array(jsonb_build_object(
        'item', v_it.id, 'nom', v_it.nom, 'qte', v_qte, 'conso', v_it.categorie = 'consommable', 'eff', v_it.effets, 'src', 'armurerie'));
    else
      v_old := v_objs -> v_idx ->> 'qte';
      v_objs := jsonb_set(v_objs, array[v_idx::text, 'qte'], to_jsonb(case when v_old ~ '^\d+$' then v_old::int else 0 end + v_qte));
    end if;
    v_data := jsonb_set(v_data, '{objets}', v_objs);
  end if;
  update characters set data = v_data where owner = v_uid;

  return v_solde - v_total;
end $$;
grant execute on function public.acheter(uuid, int) to authenticated;

-- ---------- Temps réel : prévenir les pages ouvertes des nouveaux mouvements ----------
do $$ begin
  begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.items;        exception when duplicate_object then null; end;
end $$;

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
