-- GH027–028: one canonical privacy setting; stale preferences cannot publish.
alter table public.private_user_settings add column library_visibility_version integer not null default 1 check(library_visibility_version>0);
revoke update on public.private_user_settings from service_role;
revoke update(library_visibility) on public.private_user_settings from authenticated,service_role;
revoke update(library_visibility_version) on public.private_user_settings from authenticated,service_role;
create table public.user_library (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 game_id text references public.games(id) on delete cascade,
 manual_game_id uuid references public.manual_games(id) on delete cascade,
 state text check(state in ('wishlist','playing','completed','backlog')),
 favorite boolean not null default false,
 interested boolean not null default false,
 progress integer check(progress between 0 and 100),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check((game_id is null)<>(manual_game_id is null)),
 unique(user_id,game_id), unique(user_id,manual_game_id)
);
create index library_owner_order on public.user_library(user_id,created_at desc,id);
create index library_manual_fk on public.user_library(manual_game_id);
create index library_game_fk on public.user_library(game_id);
alter table public.user_library enable row level security;
revoke all on public.user_library from public,anon,authenticated,service_role;
grant select on public.user_library to anon,authenticated;
-- Indispensable narrow definer: public readers cannot inspect private settings/authz.
-- Returns only eligibility, never settings, email or authority; fixed search_path.
create function private.library_readable(owner_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.authz a join public.private_user_settings s on s.user_id=a.user_id
 where a.user_id=owner_id and a.status='active' and
 (s.library_visibility='public' or private.is_active_owner(owner_id)));
$$;
revoke all on function private.library_readable(uuid) from public,anon,authenticated,service_role;
grant usage on schema private to anon;
grant execute on function private.library_readable(uuid) to anon,authenticated;
create policy library_read on public.user_library for select to anon,authenticated using(private.library_readable(user_id));
create view public.persisted_library_games with(security_invoker=true) as
 select id,document->>'title' as title,document->>'coverUrl' as cover_url,document->>'sourceLabel' as source_label from public.games
 union all select 'manual:'||id,title,null::text,source_label from public.manual_games;
grant select on public.persisted_library_games to anon,authenticated;
create function private.library_operation(actor uuid, session uuid, operation text, input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare entry public.user_library; gid text; mid uuid; result jsonb; current_visibility text; current_version integer; keys text[];
begin
 perform pg_catalog.pg_advisory_xact_lock(718007013);
 perform 1 from auth.sessions s where s.id=session and s.user_id=actor for share;
 if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
 perform 1 from private.authz a where a.user_id=actor and a.status='active' for share;
 if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'Invalid request' using errcode='22023'; end if;
 select array_agg(k order by k) into keys from jsonb_object_keys(input) k;
 if operation='settings' then
  if input<>'{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
 elsif operation='privacy' then
  if keys is distinct from array['version','visibility'] or jsonb_typeof(input->'version') is distinct from 'number' or coalesce(input->>'version','') !~ '^[1-9][0-9]*$' or jsonb_typeof(input->'visibility') is distinct from 'string'
   or input->>'visibility' not in ('private','public') then raise exception 'Invalid privacy' using errcode='22023'; end if;
  update public.private_user_settings set library_visibility=input->>'visibility',library_visibility_version=library_visibility_version+1
   where user_id=actor and library_visibility_version=(input->>'version')::integer;
  if not found then raise exception 'Stale privacy' using errcode='23505'; end if;
 elsif operation in ('own','create','update','remove') then
  if jsonb_typeof(input->'gameId') is distinct from 'string' then raise exception 'Invalid game' using errcode='22023'; end if;
  if input->>'gameId' ~ '^rawg:[1-9][0-9]*$' then gid:=input->>'gameId';
  elsif input->>'gameId' ~ '^manual:[0-9a-fA-F-]{36}$' then mid:=substring(input->>'gameId' from 8)::uuid;
  else raise exception 'Invalid game' using errcode='22023'; end if;
  if not exists(select 1 from public.games where id=gid) and not exists(select 1 from public.manual_games where id=mid) then raise exception 'Missing game' using errcode='22023'; end if;
  select * into entry from public.user_library where user_id=actor and (game_id=gid or manual_game_id=mid) for update;
  if operation in ('update','remove') and (jsonb_typeof(input->'id') is distinct from 'string' or jsonb_typeof(input->'version') is distinct from 'number' or coalesce(input->>'version','') !~ '^[1-9][0-9]*$') then raise exception 'Invalid version' using errcode='22023'; end if;
  if operation='own' then
   if keys is distinct from array['gameId'] then raise exception 'Invalid fields' using errcode='22023'; end if;
  elsif operation='remove' then
   if keys is distinct from array['gameId','id','version'] then raise exception 'Invalid fields' using errcode='22023'; end if;
   if entry.id is null or entry.id is distinct from (input->>'id')::uuid or entry.version is distinct from (input->>'version')::integer then raise exception 'Stale entry' using errcode='23505'; end if;
   delete from public.user_library where id=entry.id; entry:=null;
  else
   if (operation='create' and keys is distinct from array['favorite','gameId','interested','progress','state']) or
      (operation='update' and keys is distinct from array['favorite','gameId','id','interested','progress','state','version'])
    or jsonb_typeof(input->'favorite') is distinct from 'boolean' or jsonb_typeof(input->'interested') is distinct from 'boolean'
    or jsonb_typeof(input->'state') not in ('null','string') or jsonb_typeof(input->'progress') not in ('null','number')
    or (input->>'progress' is not null and input->>'progress' !~ '^[0-9]+$') then raise exception 'Invalid marks' using errcode='22023'; end if;
   if operation='create' then
    if entry.id is not null then raise exception 'Entry exists' using errcode='23505'; end if;
    insert into public.user_library(user_id,game_id,manual_game_id,state,favorite,interested,progress)
    values(actor,gid,mid,input->>'state',(input->>'favorite')::boolean,(input->>'interested')::boolean,(input->>'progress')::integer) returning * into entry;
   else
    if entry.id is null or entry.id is distinct from (input->>'id')::uuid or entry.version is distinct from (input->>'version')::integer then raise exception 'Stale entry' using errcode='23505'; end if;
    update public.user_library set state=input->>'state',favorite=(input->>'favorite')::boolean,interested=(input->>'interested')::boolean,
     progress=(input->>'progress')::integer,version=version+1,updated_at=clock_timestamp() where id=entry.id returning * into entry;
   end if;
  end if;
 else raise exception 'Invalid operation' using errcode='22023'; end if;
 select library_visibility,library_visibility_version into current_visibility,current_version from public.private_user_settings where user_id=actor;
 result:=jsonb_build_object('entry',case when entry.id is null then null else to_jsonb(entry) end,'visibility',current_visibility,'visibilityVersion',current_version);
 return result;
end; $$;
revoke all on function private.library_operation(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
