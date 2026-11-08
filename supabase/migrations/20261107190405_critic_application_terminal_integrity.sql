-- Explicit non-null terminal fields: CHECK expressions alone permit SQL NULL.
alter table private.critic_applications add constraint application_terminal_integrity check (
 status='pending' or (resolved_at is not null and reason is not null)
);
alter table private.critic_applications add constraint application_no_self_resolution check (resolved_by is null or resolved_by<>user_id);
