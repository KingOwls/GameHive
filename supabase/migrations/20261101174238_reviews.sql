-- GH-020/021: one identity for each author/game, including withdrawn content.
create function private.review_normalize(value text) returns text
language sql immutable security invoker set search_path='' as $$
 select btrim(regexp_replace(value, '[[:space:]   -     　﻿]+', ' ', 'g'));
$$;
revoke all on function private.review_normalize(text) from public,anon,authenticated,service_role;
create function private.review_points_valid(points text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
 select cardinality(points)<=5 and array_position(points,null) is null
 and not exists(select 1 from unnest(points) p where char_length(btrim(p)) not between 1 and 200);
$$;
revoke all on function private.review_points_valid(text[]) from public,anon,authenticated,service_role;
create table public.reviews (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 game_id text references public.games(id),
 manual_game_id uuid references public.manual_games(id),
 rating numeric not null check(rating between 0 and 10),
 title text not null check(char_length(btrim(title)) between 3 and 120),
 body_public text not null check(char_length(btrim(body_public)) between 20 and 10000),
 body_spoiler text not null default '' check(char_length(body_spoiler)<=20000),
 pros text[] not null default '{}' check(private.review_points_valid(pros)),
 cons text[] not null default '{}' check(private.review_points_valid(cons)),
 status text not null default 'published' check(status in ('published','withdrawn','hidden')),
 author_active boolean not null,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check((game_id is null)<>(manual_game_id is null)),
 unique(author_id,game_id), unique(author_id,manual_game_id)
);
create index reviews_game_public_idx on public.reviews(game_id,created_at desc,id) where status='published' and author_active;
create index reviews_manual_public_idx on public.reviews(manual_game_id,created_at desc,id) where status='published' and author_active;
alter table public.reviews enable row level security;
revoke all on public.reviews from public,anon,authenticated,service_role;
grant select on public.reviews to anon,authenticated;
create policy reviews_public_read on public.reviews for select to anon,authenticated using(status='published' and author_active);
-- Authorization is private; a protected invoker trigger synchronizes public eligibility.
create function private.sync_review_author_status() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 update public.reviews set author_active=(new.status='active') where author_id=new.user_id;
 return new;
end; $$;
revoke all on function private.sync_review_author_status() from public,anon,authenticated,service_role;
create trigger sync_review_author_status after update of status on private.authz for each row execute function private.sync_review_author_status();
create function private.review_operation(actor uuid, session uuid, operation text, game text, expected_version integer default null, input jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous public.reviews; result public.reviews; rawg text; manual uuid; field text; p text[]; c text[]; r numeric;
begin
 perform pg_catalog.pg_advisory_xact_lock(718007013);
 perform 1 from auth.sessions s where s.id=session and s.user_id=actor for share;
 if not found or not exists(select 1 from private.authz a where a.user_id=actor and a.status='active') then
 raise exception 'Forbidden' using errcode='42501'; end if;
 if game ~ '^rawg:[0-9]+$' then rawg:=game;
 elsif game ~* '^manual:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then manual:=substring(game from 8)::uuid;
 else raise exception 'Invalid game' using errcode='22023'; end if;
 if not exists(select 1 from public.games where id=rawg) and not exists(select 1 from public.manual_games where id=manual) then
 raise exception 'Unknown game' using errcode='22023'; end if;
 select * into previous from public.reviews where author_id=actor and (game_id=rawg or manual_game_id=manual) for update;
 if operation='own' then return case when previous.id is null then 'null'::jsonb else to_jsonb(previous) end; end if;
 if operation not in ('create','update','withdraw','republish') or operation is null then raise exception 'Invalid action' using errcode='22023'; end if;
 -- This increment only enables ordinary user authorship; critical format is GH-022.
 if not exists(select 1 from private.authz where user_id=actor and role='user') then raise exception 'Forbidden' using errcode='42501'; end if;
 if operation='create' and previous.id is not null then raise exception 'Review exists' using errcode='23505'; end if;
 if operation<>'create' then
 if previous.id is null then raise exception 'Review not found' using errcode='P0002'; end if;
 if previous.status='hidden' then raise exception 'Moderated review' using errcode='42501'; end if;
 if expected_version is null or expected_version<>previous.version then raise exception 'Version conflict' using errcode='40001'; end if;
 if (operation='withdraw' and previous.status<>'published') or (operation='republish' and previous.status<>'withdrawn') then raise exception 'State conflict' using errcode='40001'; end if;
 end if;
 if operation in ('create','update') then
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'Invalid input' using errcode='22023'; end if;
 foreach field in array array['title','bodyPublic','bodySpoiler'] loop
 if jsonb_typeof(input->field) is distinct from 'string' or input->>field ~ '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'Invalid text' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(input->'rating') is distinct from 'number' then raise exception 'Invalid rating' using errcode='22023'; end if;
 r:=(input->>'rating')::numeric;
 if r not between 0 and 10 or char_length(input->>'title')>120 or char_length(input->>'bodyPublic')>10000 or char_length(input->>'bodySpoiler')>20000
 or char_length(private.review_normalize(input->>'title'))<3 or char_length(private.review_normalize(input->>'bodyPublic'))<20 then raise exception 'Invalid bounds' using errcode='22023'; end if;
 foreach field in array array['pros','cons'] loop
 if input ? field then
 if jsonb_typeof(input->field)<>'array' then raise exception 'Invalid points' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(input->field) x where jsonb_typeof(x)<>'string') then raise exception 'Invalid points' using errcode='22023'; end if;
 end if;
 end loop;
 p:=array(select btrim(x) from jsonb_array_elements_text(coalesce(input->'pros','[]'::jsonb)) x);
 c:=array(select btrim(x) from jsonb_array_elements_text(coalesce(input->'cons','[]'::jsonb)) x);
 if not private.review_points_valid(p) or not private.review_points_valid(c) then raise exception 'Invalid points' using errcode='22023'; end if;
 if operation='update' and r<>previous.rating and private.review_normalize(input->>'bodyPublic')=private.review_normalize(previous.body_public) then raise exception 'Opinion required' using errcode='22023'; end if;
 end if;
 if operation='create' then
 insert into public.reviews(author_id,game_id,manual_game_id,rating,title,body_public,body_spoiler,pros,cons,author_active)
 values(actor,rawg,manual,r,btrim(input->>'title'),btrim(input->>'bodyPublic'),input->>'bodySpoiler',p,c,true) returning * into result;
 elsif operation='update' then
 update public.reviews set rating=r,title=btrim(input->>'title'),body_public=btrim(input->>'bodyPublic'),body_spoiler=input->>'bodySpoiler',pros=p,cons=c,version=version+1,updated_at=clock_timestamp() where id=previous.id returning * into result;
 else
 update public.reviews set status=case operation when 'withdraw' then 'withdrawn' else 'published' end,version=version+1,updated_at=clock_timestamp() where id=previous.id returning * into result;
 end if;
 insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data)
 values(actor,actor,'review.'||operation,'Author review operation',
 case when previous.id is null then '{}'::jsonb else jsonb_build_object('reviewId',previous.id,'version',previous.version,'status',previous.status) end,
 jsonb_build_object('reviewId',result.id,'gameId',game,'version',result.version,'status',result.status));
 return to_jsonb(result);
end; $$;
revoke all on function private.review_operation(uuid,uuid,text,text,integer,jsonb) from public,anon,authenticated,service_role;
