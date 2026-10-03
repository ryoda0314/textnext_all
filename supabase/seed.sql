-- Local development only (runs on `supabase db reset`, never in production).

-- An admin account you can sign up with locally (OTP mails arrive in Mailpit: http://127.0.0.1:56324).
insert into public.admin_email_allowlist (email, note)
values ('admin@example.com', 'local admin')
on conflict do nothing;

-- Push dispatch from the database container to `next dev` on the host.
insert into private.settings (key, value)
values
  ('dispatch_url', 'http://host.docker.internal:3000/api/push/dispatch'),
  ('dispatch_secret', 'local-dev-dispatch-secret')
on conflict (key) do update set value = excluded.value, updated_at = now();
