-- All writes use the direct server DB connection; never the Data API/service role.
create table public.games (
  id text primary key,
  provider text not null check (provider = 'rawg'),
  external_id bigint not null check (external_id > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 65536),
  detail_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  check (id = 'rawg:' || external_id::text)
);
alter table public.games enable row level security;
revoke all on public.games from public, anon, authenticated, service_role;
grant select on public.games to anon, authenticated;
create policy catalog_public_read on public.games for select to anon, authenticated using (true);

create table private.catalog_cache (
  key text primary key check (length(key) <= 512),
  payload jsonb not null check (octet_length(payload::text) <= 1048576),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table private.catalog_attempts (attempted_at timestamptz not null default clock_timestamp());
create index catalog_attempt_time on private.catalog_attempts (attempted_at);
alter table private.catalog_cache enable row level security;
alter table private.catalog_attempts enable row level security;
revoke all on private.catalog_cache, private.catalog_attempts from public, anon, authenticated, service_role;

create function private.catalog_reserve() returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_time_utc timestamptz := clock_timestamp(); month_start timestamptz;
begin
  perform pg_advisory_xact_lock(714017);
  current_time_utc := clock_timestamp();
  month_start := date_trunc('month', current_time_utc at time zone 'UTC') at time zone 'UTC';
  delete from private.catalog_attempts where attempted_at < least(month_start, current_time_utc - interval '1 minute');
  if (select count(*) from private.catalog_attempts where attempted_at >= month_start) >= 1000
    or (select count(*) from private.catalog_attempts where attempted_at > current_time_utc - interval '1 minute') >= 20 then
    return false;
  end if;
  insert into private.catalog_attempts values (current_time_utc);
  return true;
end $$;

create function private.catalog_store(cache_key text, value jsonb, game_docs jsonb, full_detail boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare game_doc jsonb;
begin
  -- Serializes eviction, including concurrent new keys, to guarantee <= 500 entries.
  perform pg_advisory_xact_lock(714018);
  delete from private.catalog_cache where expires_at <= clock_timestamp();
  insert into private.catalog_cache(key,payload,expires_at) values(cache_key,value,clock_timestamp()+interval '6 hours')
    on conflict(key) do update set payload=excluded.payload,expires_at=excluded.expires_at,created_at=clock_timestamp();
  delete from private.catalog_cache where key in (
    select key from private.catalog_cache order by created_at desc, key offset 500
  );
  for game_doc in select * from jsonb_array_elements(game_docs) loop
    insert into public.games(id,provider,external_id,document,detail_complete)
      values(game_doc->>'id','rawg',(game_doc->>'externalId')::bigint,game_doc,full_detail)
    on conflict(provider,external_id) do update set
      document = case when public.games.detail_complete and not full_detail
        then public.games.document || (excluded.document - 'summary' - 'description' - 'developers' - 'publishers')
        else public.games.document || excluded.document end,
      detail_complete=public.games.detail_complete or full_detail, updated_at=clock_timestamp();
  end loop;
end $$;
revoke all on function private.catalog_reserve(), private.catalog_store(text,jsonb,jsonb,boolean) from public, anon, authenticated, service_role;
