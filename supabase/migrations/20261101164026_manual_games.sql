-- GH-018: separate public catalog, no provider/cache/budget mutation.
create function private.manual_source(source text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare parts text[]; host text; port text; suffix text;
begin
 if source is null or char_length(source)>2048 or source ~ '[[:space:]\\]' then raise exception 'Invalid source' using errcode='22023'; end if;
 parts := regexp_match(source, '^https://([^/:?#]+)(:[0-9]{1,5})?([^#]*)(#.*)?$', 'i');
 if parts is null then raise exception 'Invalid source' using errcode='22023'; end if;
 host := lower(parts[1]); port := coalesce(parts[2],''); suffix := coalesce(parts[3],'');
 if host !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$'
 or host ~ '(^|\.)(localhost|local|internal|test|invalid)$'
 or (port<>'' and substring(port from 2)::int not between 1 and 65535) then
 raise exception 'Invalid source' using errcode='22023'; end if;
 if port=':443' then port:=''; end if;
 if suffix='' or left(suffix,1)='?' then suffix:='/'||suffix; end if;
 return 'https://'||host||port||suffix;
end; $$;
revoke all on function private.manual_source(text) from public,anon,authenticated,service_role;
create table public.manual_games (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 1 and 160 and title !~ '[<>[:cntrl:]]'),
 synopsis text not null check (char_length(btrim(synopsis)) between 20 and 4000 and synopsis !~ '[<>]'),
 platforms text[] not null check (cardinality(platforms) between 1 and 4 and platforms <@ array['PC','PlayStation','Xbox','Nintendo'] and array_position(platforms,null) is null),
 genres text[] not null check (cardinality(genres) between 1 and 8 and array_position(genres,null) is null),
 released_at date check (released_at between date '1900-01-01' and date '2099-12-31'),
 source_url text not null unique,
 source_label text not null check (char_length(btrim(source_label)) between 1 and 100 and source_label !~ '[<>[:cntrl:]]'),
 created_at timestamptz not null default now()
);
alter table public.manual_games enable row level security;
revoke all on public.manual_games from public,anon,authenticated,service_role;
grant select on public.manual_games to anon,authenticated;
create policy manual_public_read on public.manual_games for select to anon,authenticated using(true);
create index manual_games_title_idx on public.manual_games(title,id);
create function private.create_manual_game(actor uuid, session uuid, input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.manual_games; p text[]; g text[]; canonical text; release date;
begin
 perform pg_catalog.pg_advisory_xact_lock(718007013);
 -- Lock the actual session as well as sharing G1's authority lock.
 perform 1 from auth.sessions s where s.id=session and s.user_id=actor for share;
 if not found or not exists(select 1 from private.authz a where a.user_id=actor and a.role='admin' and a.status='active') then
 raise exception 'Forbidden' using errcode='42501'; end if;
 if input is null or jsonb_typeof(input)<>'object' or
 jsonb_typeof(input->'platforms') is distinct from 'array' or jsonb_typeof(input->'genres') is distinct from 'array' then
 raise exception 'Invalid input' using errcode='22023'; end if;
 foreach canonical in array array['title','synopsis','sourceUrl','sourceLabel','reason'] loop
 if jsonb_typeof(input->canonical) is distinct from 'string' or (input->>canonical) ~ '[<>]' or (input->>canonical) ~ '[\x00-\x08\x0b-\x1f\x7f]' then raise exception 'Invalid text' using errcode='22023'; end if;
 end loop;
 if char_length(btrim(input->>'reason')) not between 10 and 500 then raise exception 'Invalid reason' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(input->'platforms') x where jsonb_typeof(x)<>'string') or exists(select 1 from jsonb_array_elements(input->'genres') x where jsonb_typeof(x)<>'string') then raise exception 'Invalid list' using errcode='22023'; end if;
 if char_length(input->>'title')>160 or char_length(input->>'synopsis')>4000 or char_length(input->>'sourceLabel')>100 or char_length(input->>'reason')>500
 or jsonb_array_length(input->'platforms') not between 1 and 4 or jsonb_array_length(input->'genres') not between 1 and 8
 or (input->'releasedAt' is not null and jsonb_typeof(input->'releasedAt') not in ('string','null')) then raise exception 'Invalid bounds' using errcode='22023'; end if;
 p:=array(select distinct btrim(x) from jsonb_array_elements_text(input->'platforms') x);
 g:=array(select distinct btrim(x) from jsonb_array_elements_text(input->'genres') x);
 if exists(select 1 from unnest(g) x where char_length(x) not between 1 and 40 or x ~ '[<>[:cntrl:]]') then raise exception 'Invalid genre' using errcode='22023'; end if;
 canonical:=private.manual_source(input->>'sourceUrl');
 if input->>'releasedAt' is not null and input->>'releasedAt'<>'' then
 if input->>'releasedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date' using errcode='22023'; end if;
 release:=(input->>'releasedAt')::date;
 end if;
 insert into public.manual_games(title,synopsis,platforms,genres,released_at,source_url,source_label)
 values(btrim(input->>'title'),btrim(input->>'synopsis'),p,g,release,canonical,btrim(input->>'sourceLabel')) returning * into result;
 insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data)
 values(actor,null,'manual_game.create',btrim(input->>'reason'),'{}',jsonb_build_object('gameId','manual:'||result.id));
 return to_jsonb(result);
end; $$;
revoke all on function private.create_manual_game(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
