-- Accepted URL query is <=1024 encoded characters; canonical defaults/path keep key <2048.
alter table private.catalog_cache drop constraint catalog_cache_key_check;
alter table private.catalog_cache add constraint catalog_cache_key_check check (length(key) <= 2048);
