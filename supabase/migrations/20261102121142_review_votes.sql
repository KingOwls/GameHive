-- GH-024. API roles can read their own history, but only the private invoker writes.
alter table public.reviews add column helpful_count integer not null default 0 check(helpful_count>=0),
 add column unhelpful_count integer not null default 0 check(unhelpful_count>=0);
create table public.review_votes (
 review_id uuid not null references public.reviews(id) on delete cascade,
 voter_id uuid not null references public.profiles(id) on delete cascade,
 value smallint not null check(value in (-1,1)),
 created_at timestamptz not null default clock_timestamp(),
 primary key(review_id,voter_id)
);
create index review_votes_voter_time_idx on public.review_votes(voter_id,created_at);
alter table public.review_votes enable row level security;
revoke all on public.review_votes from public,anon,authenticated,service_role;
grant select on public.review_votes to authenticated;
create policy review_votes_own_read on public.review_votes for select to authenticated
 using(private.is_active_owner(voter_id));
-- Even trusted application code cannot accidentally revise a historical sign or date.
create function private.review_vote_immutable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then raise exception 'Irreversible vote' using errcode='42501'; end if;
 new.created_at:=clock_timestamp();
 return new;
end; $$;
revoke all on function private.review_vote_immutable() from public,anon,authenticated,service_role;
create trigger review_vote_immutable before insert or update on public.review_votes
 for each row execute function private.review_vote_immutable();
-- INSERT and operator DELETE/cascades share the same delta synchronization.
-- Parent deletion needs no update; deleting a voter decrements surviving parents.
create function private.sync_review_vote_counts() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  update public.reviews set helpful_count=helpful_count+case when new.value=1 then 1 else 0 end,
   unhelpful_count=unhelpful_count+case when new.value=-1 then 1 else 0 end where id=new.review_id;
  return new;
 else
  update public.reviews set helpful_count=helpful_count-case when old.value=1 then 1 else 0 end,
   unhelpful_count=unhelpful_count-case when old.value=-1 then 1 else 0 end where id=old.review_id;
  return old;
 end if;
end; $$;
revoke all on function private.sync_review_vote_counts() from public,anon,authenticated,service_role;
create trigger sync_review_vote_counts after insert or delete on public.review_votes
 for each row execute function private.sync_review_vote_counts();
create function private.review_vote_operation(actor uuid, session uuid, operation text, ids uuid[], vote_value integer default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.reviews; stamp timestamptz; result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(718007013);
 perform 1 from auth.sessions s where s.id=session and s.user_id=actor for share;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from private.authz a where a.user_id=actor and a.status='active' for share;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if ids is null or cardinality(ids) not between 1 and 10 or array_ndims(ids)<>1
 or array_position(ids,null) is not null or (select count(distinct id) from unnest(ids) id)<>cardinality(ids) then
  raise exception 'Invalid review IDs' using errcode='22023'; end if;
 if operation='own' then
  -- A lost ACK remains recoverable after withdrawal/suspension of the review's author.
  select jsonb_build_object('votes',coalesce(jsonb_agg(jsonb_build_object(
   'reviewId',requested.id,'value',v.value,
   'helpfulCount',case when r.status='published' and r.author_active then r.helpful_count else null end,
   'unhelpfulCount',case when r.status='published' and r.author_active then r.unhelpful_count else null end)
   order by requested.ordinality),'[]'::jsonb)) into result
  from unnest(ids) with ordinality requested(id,ordinality)
  left join public.reviews r on r.id=requested.id
  left join public.review_votes v on v.review_id=requested.id and v.voter_id=actor;
  return result;
 end if;
 if operation is distinct from 'vote' or cardinality(ids)<>1 or vote_value is null or vote_value not in (-1,1) then
  raise exception 'Invalid vote' using errcode='22023'; end if;
 select * into target from public.reviews where id=ids[1] for update;
 if target.id is null or target.author_id=actor or target.status<>'published' or not target.author_active
 or not exists(select 1 from private.authz where user_id=target.author_id and status='active') then
  raise exception 'Forbidden' using errcode='42501'; end if;
 if exists(select 1 from public.review_votes where review_id=target.id and voter_id=actor) then
  raise exception 'Vote exists' using errcode='23505'; end if;
 stamp:=clock_timestamp();
 if (select count(*) from public.review_votes where voter_id=actor and created_at>stamp-interval '60 seconds')>=20
 or (select count(*) from public.review_votes where voter_id=actor and created_at>=(date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC'))>=100 then
  raise exception 'Vote quota exceeded' using errcode='P0429'; end if;
 insert into public.review_votes(review_id,voter_id,value) values(target.id,actor,vote_value);
 insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data)
 values(actor,target.author_id,'review.vote','Irreversible review vote','{}',jsonb_build_object('reviewId',target.id,'value',vote_value));
 select jsonb_build_object('reviewId',id,'value',vote_value,'helpfulCount',helpful_count,'unhelpfulCount',unhelpful_count)
 into result from public.reviews where id=target.id;
 return result;
end; $$;
revoke all on function private.review_vote_operation(uuid,uuid,text,uuid[],integer) from public,anon,authenticated,service_role;
