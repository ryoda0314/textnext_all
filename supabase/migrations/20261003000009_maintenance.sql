-- =============================================================================
-- Scheduled maintenance (pg_cron, every 15 minutes).
--   * meet-up day reminders (from 7:00 JST)
--   * negotiations with no activity for 7 days are cancelled (item reopens)
--   * scheduled trades 7 days past the meet-up date are cancelled (item hidden,
--     the seller decides whether to relist)
--   * hand-overs not rated within 7 days are finalised
--   * old notifications and old closed-trade chats are purged (see privacy policy)
-- =============================================================================

create extension if not exists pg_cron;

create or replace function private.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_jst();
  v_hour int := extract(hour from (now() at time zone 'Asia/Tokyo'))::int;
  v_trade record;
  v_reminded int := 0;
  v_expired int := 0;
  v_expired_after int := 0;
  v_finalised int := 0;
  v_purged_messages int := 0;
  v_purged_notifications int := 0;
begin
  if v_hour >= 7 then
    for v_trade in
      select t.* from public.trades t
      where t.status = 'scheduled'
        and t.meetup_date = v_today
        and t.meetup_reminded_on is distinct from v_today
      for update skip locked
    loop
      update public.trades set meetup_reminded_on = v_today where id = v_trade.id;
      perform private.notify(v_trade.buyer_id, 'meetup_reminder', '今日は受け渡しの日です',
        '「' || v_trade.item_title || '」 ' || coalesce(v_trade.meetup_time, private.slot_label(v_trade.university_id, v_trade.meetup_slot))
          || ' / ' || coalesce(v_trade.meetup_place, ''), '/trades/' || v_trade.id, v_trade.id, v_trade.item_id);
      perform private.notify(v_trade.seller_id, 'meetup_reminder', '今日は受け渡しの日です',
        '「' || v_trade.item_title || '」 ' || coalesce(v_trade.meetup_time, private.slot_label(v_trade.university_id, v_trade.meetup_slot))
          || ' / ' || coalesce(v_trade.meetup_place, ''), '/trades/' || v_trade.id, v_trade.id, v_trade.item_id);
      v_reminded := v_reminded + 1;
    end loop;
  end if;

  for v_trade in
    select t.id from public.trades t
    where t.status = 'negotiating' and t.last_message_at < now() - interval '7 days'
    for update skip locked
  loop
    perform private.cancel_trade_internal(v_trade.id, null, 'expired', null);
    v_expired := v_expired + 1;
  end loop;

  for v_trade in
    select t.id from public.trades t
    where t.status = 'scheduled' and t.meetup_date < v_today - 7
    for update skip locked
  loop
    perform private.cancel_trade_internal(v_trade.id, null, 'expired_after_meetup', null);
    v_expired_after := v_expired_after + 1;
  end loop;

  for v_trade in
    select t.id from public.trades t
    where t.status = 'handed_over' and t.handed_over_at < now() - interval '7 days'
    for update skip locked
  loop
    perform private.finalize_trade(v_trade.id);
    v_finalised := v_finalised + 1;
  end loop;

  -- Chats of trades closed more than 90 days ago (kept while a report is open).
  -- Chat image files are removed by the app's /api/cron/cleanup job.
  with doomed as (
    select t.id from public.trades t
    where t.status in ('completed', 'cancelled')
      and coalesce(t.completed_at, t.cancelled_at) < now() - interval '90 days'
      and not exists (
        select 1 from public.reports r
        where r.target_type = 'trade' and r.target_id = t.id and r.status = 'open')
  )
  delete from public.messages m
  using doomed d
  where m.trade_id = d.id and m.kind <> 'image';
  get diagnostics v_purged_messages = row_count;

  delete from public.notifications where created_at < now() - interval '180 days';
  get diagnostics v_purged_notifications = row_count;

  return jsonb_build_object(
    'reminded', v_reminded, 'expired', v_expired, 'expired_after_meetup', v_expired_after,
    'finalised', v_finalised, 'purged_messages', v_purged_messages,
    'purged_notifications', v_purged_notifications);
end;
$$;

-- Chat image files of long-closed trades, for the storage cleanup job (service role).
create or replace function public.stale_chat_images(p_limit int default 200)
returns table (message_id uuid, image_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.image_path
  from public.messages m
  join public.trades t on t.id = m.trade_id
  where m.kind = 'image'
    and t.status in ('completed', 'cancelled')
    and coalesce(t.completed_at, t.cancelled_at) < now() - interval '90 days'
    and not exists (
      select 1 from public.reports r
      where r.target_type = 'trade' and r.target_id = t.id and r.status = 'open')
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke execute on function public.stale_chat_images(int) from public, anon, authenticated;
grant execute on function public.stale_chat_images(int) to service_role;

select cron.schedule('textnext-maintenance', '*/15 * * * *', $$select private.run_maintenance();$$);
