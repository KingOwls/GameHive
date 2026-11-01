-- GH-007–013. No authority is derived from editable Auth metadata.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

create type private.account_role as enum ('user', 'critic', 'moderator', 'admin');
create type private.account_status as enum ('active', 'suspended');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  username_normalized text generated always as (lower(username collate "C")) stored unique,
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_key text not null default 'hive' check (avatar_key in ('hive', 'orbit', 'spark')),
  reputation_score smallint not null default 0 check (reputation_score between 0 and 100),
  created_at timestamptz not null default now()
);
create table public.private_user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme_mode text not null default 'system' check (theme_mode in ('system','dark','light')),
  library_visibility text not null default 'private' check (library_visibility in ('private','public')),
  platforms text[] not null default '{}' check (cardinality(platforms) <= 10 and platforms <@ array['PC','PlayStation','Xbox','Nintendo']),
  genres text[] not null default '{}' check (cardinality(genres) <= 10 and genres <@ array['Acción','Aventura','RPG','Estrategia','Indie','Deportes']),
  interests text not null default '' check (char_length(interests) <= 500),
  onboarding_complete boolean not null default false
);
create table private.authz (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role private.account_role not null default 'user',
  status private.account_status not null default 'active',
  critic_verified boolean not null default false
);
create table private.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  before_data jsonb not null,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.private_user_settings enable row level security;
alter table private.authz enable row level security;
alter table private.audit_logs enable row level security;
revoke all on public.profiles, public.private_user_settings from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated, service_role;
revoke all on all sequences in schema private from public, anon, authenticated, service_role;

-- Indispensable definer: Auth runs as supabase_auth_admin, not application table owner.
-- Only invoked by Auth trigger; non-exposed schema, empty search_path, no client EXECUTE.
create function private.initialize_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username) values (new.id, new.raw_user_meta_data ->> 'username');
  insert into public.private_user_settings(user_id) values (new.id);
  insert into private.authz(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.initialize_identity() from public, anon, authenticated, service_role;
create trigger initialize_identity after insert on auth.users for each row execute function private.initialize_identity();

-- Narrow predicate needed by RLS: no arbitrary subject argument, no role/PII returned.
-- Also checks session existence: old access tokens after logout/deletion cannot write.
create function private.is_active_owner(subject uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select subject = (select auth.uid()) and exists (
    select 1 from private.authz a join auth.sessions s on s.user_id = a.user_id
    where a.user_id = (select auth.uid()) and a.status = 'active'
      and s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  );
$$;
revoke all on function private.is_active_owner(uuid) from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_active_owner(uuid) to authenticated;
grant select on public.profiles to anon, authenticated;
grant update(username,bio,avatar_key) on public.profiles to authenticated;
grant select on public.private_user_settings to authenticated;
grant update(theme_mode,library_visibility,platforms,genres,interests,onboarding_complete) on public.private_user_settings to authenticated;
create policy public_profiles on public.profiles for select to anon, authenticated using (true);
create policy update_own_profile on public.profiles for update to authenticated
  using (private.is_active_owner(id)) with check (private.is_active_owner(id));
create policy own_settings_read on public.private_user_settings for select to authenticated
  using (private.is_active_owner(user_id));
create policy own_settings_update on public.private_user_settings for update to authenticated
  using (private.is_active_owner(user_id)) with check (private.is_active_owner(user_id));

-- Edge functions call these with a direct DB connection, never via Data API.
-- SECURITY INVOKER: caller must be trusted DB operator; API roles have no EXECUTE.
create function private.current_identity(actor uuid, session uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare identity jsonb;
begin
  select jsonb_build_object('id',a.user_id,'role',a.role,'status',a.status,'criticVerified',a.critic_verified)
    into identity from private.authz a
    where a.user_id = actor and exists(select 1 from auth.sessions s where s.id = session and s.user_id = actor);
  if identity is null then raise exception 'Unauthorized' using errcode='42501'; end if;
  return identity;
end;
$$;
revoke all on function private.current_identity(uuid,uuid) from public, anon, authenticated, service_role;

create function private.admin_update_identity(actor uuid, session uuid, target uuid, requested_role text,
  requested_status text, verified boolean, reason text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare previous jsonb; result jsonb;
begin
  -- Serialize admin changes, including last-admin checks and concurrent suspensions.
  perform pg_catalog.pg_advisory_xact_lock(718007013);
  if not exists(select 1 from private.authz a join auth.sessions s on s.user_id=a.user_id
    where a.user_id=actor and a.role='admin' and a.status='active' and s.id=session)
    or actor=target then raise exception 'Forbidden' using errcode='42501'; end if;
  if reason is null or char_length(btrim(reason)) not between 10 and 500
    or requested_role is null or requested_status is null or verified is null then
    raise exception 'Invalid request' using errcode='22023'; end if;
  select to_jsonb(a) into previous from private.authz a where a.user_id=target for update;
  if previous is null then raise exception 'Invalid request' using errcode='22023'; end if;
  if previous->>'role'='admin' and previous->>'status'='active'
     and (requested_role <> 'admin' or requested_status <> 'active')
     and (select count(*) from private.authz where role='admin' and status='active') <= 1 then
    raise exception 'Forbidden' using errcode='42501'; end if;
  update private.authz set role=requested_role::private.account_role,
    status=requested_status::private.account_status, critic_verified=verified where user_id=target;
  select to_jsonb(a) into result from private.authz a where a.user_id=target;
  insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data)
    values(actor,target,'identity.update',btrim(reason),previous,result);
  return result;
end;
$$;
revoke all on function private.admin_update_identity(uuid,uuid,uuid,text,text,boolean,text) from public, anon, authenticated, service_role;
create index audit_logs_actor_idx on private.audit_logs(actor_id);
create index audit_logs_target_idx on private.audit_logs(target_id);
