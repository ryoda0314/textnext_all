-- =============================================================================
-- In-app notifications, Web Push subscriptions, and push dispatch.
--
-- Push delivery: inserting a notification (or a chat message) makes pg_net call
-- the app's /api/push/dispatch endpoint, which sends Web Push (and e-mail for
-- important events). Configure once per environment:
--   insert into private.settings (key, value) values
--     ('dispatch_url', 'https://<your-app>/api/push/dispatch'),
--     ('dispatch_secret', '<same value as PUSH_DISPATCH_SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
-- Without these rows nothing is sent and in-app notifications still work.
-- =============================================================================

create extension if not exists pg_net;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  trade_id uuid,
  item_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint notifications_link_relative check (link is null or link ~ '^/[^/]')
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  constraint push_subscriptions_endpoint_https check (endpoint ~ '^https://')
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Internal helper: only delivers to live accounts.
create or replace function private.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_trade_id uuid default null,
  p_item_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link, trade_id, item_id)
  select p_user_id, p_type, p_title, p_body, p_link, p_trade_id, p_item_id
  where exists (select 1 from public.profiles p where p.id = p_user_id and p.deleted_at is null);
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any (p_ids));
$$;

-- A browser/device belongs to whoever subscribed last on it.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
begin
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now();

  -- keep at most 10 devices per member
  delete from public.push_subscriptions s
  where s.user_id = v_uid
    and s.id not in (
      select id from public.push_subscriptions where user_id = v_uid order by created_at desc limit 10
    );
end;
$$;

create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.value into v_url from private.settings s where s.key = 'dispatch_url';
  select s.value into v_secret from private.settings s where s.key = 'dispatch_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('source', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 4000
  );
  return null;
exception
  when others then
    -- Push is best effort: never fail the write that triggered it.
    raise warning 'textnext push dispatch failed: %', sqlerrm;
    return null;
end;
$$;

create trigger notifications_dispatch after insert on public.notifications
  for each row execute function private.dispatch_push();

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications, public.push_subscriptions from anon, authenticated;
grant select on public.notifications to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.notifications, public.push_subscriptions to service_role;

revoke execute on function public.mark_notifications_read(uuid[]),
  public.register_push_subscription(text, text, text, text) from public;
grant execute on function public.mark_notifications_read(uuid[]),
  public.register_push_subscription(text, text, text, text) to authenticated;
