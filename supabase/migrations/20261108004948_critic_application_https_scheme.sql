-- HTTPS schemes are case insensitive; preserve all other link restrictions.
create or replace function private.valid_application_links(links jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare link jsonb;
begin
 if jsonb_typeof(links) is distinct from 'array' or jsonb_array_length(links)>3 then return false; end if;
 for link in select value from jsonb_array_elements(links) loop
  if jsonb_typeof(link)<>'string' or char_length(link#>>'{}')>2048 or (link#>>'{}') !~* '^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$' then return false; end if;
 end loop;
 return true;
end; $$;
revoke all on function private.valid_application_links(jsonb) from public,anon,authenticated,service_role;
