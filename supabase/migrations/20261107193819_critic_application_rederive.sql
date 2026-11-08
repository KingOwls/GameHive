-- JS String.trim whitespace, explicitly enumerated so SQL and the gateway agree.
create function private.application_trim(value text) returns text
language sql immutable strict security invoker set search_path='' as $$
 select btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
create function private.application_cooldown_elapsed(next_allowed timestamptz, observed_at timestamptz) returns boolean
language sql immutable security invoker set search_path='' as $$ select next_allowed is null or observed_at>=next_allowed; $$;
revoke all on function private.application_trim(text),private.application_cooldown_elapsed(timestamptz,timestamptz) from public,anon,authenticated,service_role;
-- Keep old constraints and strengthen them; never rewrite the applied migrations.
alter table private.critic_applications add constraint application_normalized_evidence check (
 organization=private.application_trim(organization) and char_length(organization) between 3 and 120
 and experience=private.application_trim(experience) and char_length(experience) between 40 and 3000
 and sample=private.application_trim(sample) and char_length(sample) between 40 and 5000
 and (reason is null or (reason=private.application_trim(reason) and char_length(reason) between 10 and 500))
);
alter table private.application_notices add constraint application_normalized_notice check(reason=private.application_trim(reason) and char_length(reason) between 10 and 500);
create or replace function private.critic_application_operation(actor uuid, session uuid, operation text, input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare authority private.authz; target private.authz; application private.critic_applications;
 keys text[]; result jsonb; page_number integer; total bigint; next_allowed timestamptz; decision text; notice private.application_notices;
begin
 perform pg_catalog.pg_advisory_xact_lock(718007013);
 perform 1 from auth.sessions s where s.id=session and s.user_id=actor for share;
 if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
 select * into authority from private.authz where user_id=actor for share;
 if authority.user_id is null or (operation not in ('own-notices','markRead') and authority.status<>'active') then raise exception 'Account unavailable' using errcode='42501'; end if;
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'Invalid request' using errcode='22023'; end if;
 select array_agg(k order by k) into keys from jsonb_object_keys(input) k;
 if operation in ('own-history','admin-queue','admin-history','own-notices') then
  if keys is distinct from array['page'] or jsonb_typeof(input->'page') is distinct from 'number' or coalesce(input->>'page','') !~ '^[1-9][0-9]{0,4}$' then raise exception 'Invalid page' using errcode='22023'; end if;
  page_number:=(input->>'page')::integer;
  if operation in ('admin-queue','admin-history') and authority.role<>'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  if operation='own-notices' then
   select count(*) into total from private.application_notices where user_id=actor;
   select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id),'[]') into result from
    (select * from private.application_notices where user_id=actor order by created_at desc,id limit 20 offset (page_number-1)*20) n;
  else
   select count(*) into total from private.critic_applications a where (operation='own-history' and a.user_id=actor) or (operation='admin-queue' and a.status='pending') or operation='admin-history';
   select coalesce(jsonb_agg(to_jsonb(a) || case when operation in ('admin-queue','admin-history') then jsonb_build_object('current_authority',(select jsonb_build_object('role',z.role,'status',z.status,'critic_verified',z.critic_verified) from private.authz z where z.user_id=a.user_id)) else '{}'::jsonb end order by a.created_at desc,a.id),'[]') into result from
    (select * from private.critic_applications a where (operation='own-history' and a.user_id=actor) or (operation='admin-queue' and a.status='pending') or operation='admin-history' order by created_at desc,id limit 20 offset (page_number-1)*20) a;
  end if;
  select max(resolved_at)+interval '168 hours' into next_allowed from private.critic_applications where user_id=actor and status='rejected';
  return jsonb_build_object('items',result,'total',total,'page',page_number,'pageSize',20,'eligible',authority.status='active' and (authority.role='user' or (authority.role='critic' and not authority.critic_verified)),
   'nextAllowedAt',next_allowed,'hasPending',exists(select 1 from private.critic_applications where user_id=actor and status='pending'));
 elsif operation='admin-get' then
  if authority.role<>'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  if keys is distinct from array['id'] or jsonb_typeof(input->'id') is distinct from 'string' then raise exception 'Invalid id' using errcode='22023'; end if;
  select to_jsonb(a)||jsonb_build_object('current_authority',jsonb_build_object('role',z.role,'status',z.status,'critic_verified',z.critic_verified)) into result
   from private.critic_applications a join private.authz z on z.user_id=a.user_id where a.id=(input->>'id')::uuid;
  if result is null then raise exception 'Unavailable application' using errcode='42501'; end if;
  return result;
 elsif operation='markRead' then
  if keys is distinct from array['id'] or jsonb_typeof(input->'id') is distinct from 'string' then raise exception 'Invalid notice' using errcode='22023'; end if;
  update private.application_notices set read_at=coalesce(read_at,clock_timestamp()) where id=(input->>'id')::uuid and user_id=actor returning * into notice;
  if notice.id is null then raise exception 'Forbidden' using errcode='42501'; end if;
  return to_jsonb(notice);
 elsif operation='submit' then
  if not (authority.role='user' or (authority.role='critic' and not authority.critic_verified)) then raise exception 'Forbidden' using errcode='42501'; end if;
  if keys is distinct from array['experience','links','organization','sample'] or jsonb_typeof(input->'organization') is distinct from 'string'
   or jsonb_typeof(input->'experience') is distinct from 'string' or jsonb_typeof(input->'sample') is distinct from 'string'
   or not private.valid_application_links(input->'links') then raise exception 'Invalid evidence' using errcode='22023'; end if;
  if exists(select 1 from private.critic_applications where user_id=actor and status='pending') then raise exception 'Pending application' using errcode='23505'; end if;
  select max(resolved_at)+interval '168 hours' into next_allowed from private.critic_applications where user_id=actor and status='rejected';
  if not private.application_cooldown_elapsed(next_allowed,clock_timestamp()) then raise exception 'Cooldown' using errcode='23505'; end if;
  insert into private.critic_applications(user_id,organization,experience,sample,links,expected_role,expected_status,expected_verified)
   values(actor,private.application_trim(input->>'organization'),private.application_trim(input->>'experience'),private.application_trim(input->>'sample'),input->'links',authority.role,authority.status,authority.critic_verified) returning * into application;
  insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data) values(actor,actor,'critic_application.submit','Candidatura privada presentada','{}',jsonb_build_object('id',application.id,'status','pending'));
  return to_jsonb(application);
 elsif operation in ('resolve','cancel') then
  if authority.role<>'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  if (operation='resolve' and keys is distinct from array['decision','id','reason','version']) or (operation='cancel' and keys is distinct from array['id','reason','version'])
   or jsonb_typeof(input->'id') is distinct from 'string' or jsonb_typeof(input->'reason') is distinct from 'string'
   or char_length(private.application_trim(input->>'reason')) not between 10 and 500 or jsonb_typeof(input->'version') is distinct from 'number'
   or coalesce(input->>'version','') !~ '^[1-9][0-9]*$' then raise exception 'Invalid resolution' using errcode='22023'; end if;
  decision:=case when operation='cancel' then 'cancelled' else input->>'decision' end;
  if decision is null or decision not in ('approved','rejected','cancelled') or (operation='resolve' and decision='cancelled') then raise exception 'Invalid decision' using errcode='22023'; end if;
  select * into application from private.critic_applications where id=(input->>'id')::uuid for update;
  if application.user_id=actor then raise exception 'Self resolution forbidden' using errcode='42501'; end if;
  if application.id is null or application.status<>'pending' or application.version<>(input->>'version')::integer then raise exception 'Stale application' using errcode='23505'; end if;
  select * into target from private.authz where user_id=application.user_id for update;
  if target.user_id is null or target.status<>'active' then raise exception 'Target suspended' using errcode='23505'; end if;
  if operation='cancel' then
   if target.role=application.expected_role and target.critic_verified=application.expected_verified then raise exception 'Authority unchanged' using errcode='23505'; end if;
  elsif target.role<>application.expected_role or target.status<>application.expected_status or target.critic_verified<>application.expected_verified then raise exception 'Target changed' using errcode='23505'; end if;
  if decision='approved' then update private.authz set role='critic',critic_verified=true where user_id=application.user_id; end if;
  update private.critic_applications set status=decision,version=version+1,resolved_by=actor,resolved_at=clock_timestamp(),reason=private.application_trim(input->>'reason') where id=application.id;
  insert into private.application_notices(user_id,application_id,outcome,reason) values(application.user_id,application.id,decision,private.application_trim(input->>'reason'));
  insert into private.audit_logs(actor_id,target_id,action,reason,before_data,after_data)
   values(actor,application.user_id,'critic_application.'||decision,private.application_trim(input->>'reason'),jsonb_build_object('id',application.id,'status',application.status,'role',target.role,'critic_verified',target.critic_verified),jsonb_build_object('id',application.id,'status',decision,'role',case when decision='approved' then 'critic' else target.role::text end,'critic_verified',case when decision='approved' then true else target.critic_verified end));
  select to_jsonb(a) into result from private.critic_applications a where id=application.id;
  return result;
 else raise exception 'Invalid operation' using errcode='22023'; end if;
end; $$;
revoke all on function private.critic_application_operation(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
