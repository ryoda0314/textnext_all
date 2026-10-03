-- =============================================================================
-- Trades: request → agree on time & place → hand over → rate.
--
--   negotiating ──confirm_meetup──▶ scheduled
--        ▲   └────────────┐            │ propose_meetup (reschedule)
--        └────────────────┼────────────┘
--   negotiating / scheduled ──complete_handover (code) / confirm_handover ×2──▶ handed_over
--   handed_over ──both rated (or 7 days)──▶ completed
--   negotiating / scheduled ──cancel_trade / expiry──▶ cancelled
--
-- Item status follows: active ─request─▶ reserved ─hand over─▶ sold
--                      reserved ─cancel─▶ active (or hidden when the seller withdrew)
--
-- Clients cannot write trades directly; every transition is an RPC below that
-- checks who is acting and records a system message + notification atomically.
-- =============================================================================

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  item_id uuid not null references public.items(id),
  seller_id uuid not null references public.profiles(id),
  buyer_id uuid not null references public.profiles(id),
  -- Snapshot of what was agreed, so history survives later edits/removal.
  item_title text not null,
  item_image text,
  price int not null,
  payment_method text not null,
  status text not null default 'negotiating',
  -- Open proposal: {by, slots:[{date, slot}], spot_ids:[uuid], other_place, note, at}
  proposal jsonb,
  meetup_date date,
  meetup_slot text,
  meetup_time text,
  meetup_spot_id uuid references public.meetup_spots(id) on delete set null,
  meetup_place text,
  meetup_confirmed_at timestamptz,
  meetup_reminded_on date,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  handed_over_at timestamptz,
  handover_method text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  cancel_note text,
  buyer_read_at timestamptz,
  seller_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_parties check (buyer_id <> seller_id),
  constraint trades_status_values check (status in ('negotiating', 'scheduled', 'handed_over', 'completed', 'cancelled')),
  constraint trades_payment_values check (payment_method in ('cash', 'cashless', 'either')),
  constraint trades_handover_values check (handover_method is null or handover_method in ('code', 'mutual', 'admin')),
  constraint trades_cancel_values check (cancel_reason is null or cancel_reason in (
    'schedule_mismatch', 'buyer_withdrew', 'seller_withdrew', 'no_response', 'other',
    'expired', 'expired_after_meetup', 'account_deleted', 'admin')),
  constraint trades_meetup_time_format check (meetup_time is null or meetup_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create unique index trades_one_open_per_item on public.trades (item_id)
  where status in ('negotiating', 'scheduled', 'handed_over');
create index trades_buyer_idx on public.trades (buyer_id, last_message_at desc);
create index trades_seller_idx on public.trades (seller_id, last_message_at desc);
create index trades_open_status_idx on public.trades (status, last_message_at)
  where status in ('negotiating', 'scheduled', 'handed_over');

create trigger trades_touch before update on public.trades
  for each row execute function private.touch_updated_at();

-- Hand-over codes live outside the API surface so the buyer can never read them.
create table private.handover_codes (
  trade_id uuid primary key references public.trades(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  kind text not null default 'text',
  body text,
  image_path text,
  -- System messages: machine-readable event + payload, rendered as cards by the client.
  event text,
  payload jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint messages_kind_values check (kind in ('text', 'image', 'system')),
  constraint messages_text_body check (kind <> 'text' or (body is not null and char_length(body) between 1 and 1000)),
  constraint messages_image_path check (kind <> 'image' or image_path is not null),
  constraint messages_system_shape check (kind <> 'system' or (sender_id is null and event is not null)),
  constraint messages_user_shape check (kind = 'system' or (sender_id is not null and event is null and payload is null))
);
create index messages_trade_idx on public.messages (trade_id, created_at);

create table public.ratings (
  trade_id uuid not null references public.trades(id) on delete cascade,
  rater_id uuid not null references public.profiles(id),
  ratee_id uuid not null references public.profiles(id),
  rater_role text not null,
  score text not null,
  comment text,
  created_at timestamptz not null default now(),
  primary key (trade_id, rater_id),
  constraint ratings_role_values check (rater_role in ('buyer', 'seller')),
  constraint ratings_score_values check (score in ('good', 'normal', 'bad')),
  constraint ratings_comment_length check (comment is null or char_length(comment) <= 200)
);
create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Message plumbing
-- -----------------------------------------------------------------------------

create or replace function private.post_system_message(
  p_trade_id uuid,
  p_event text,
  p_body text,
  p_payload jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.messages (trade_id, kind, body, event, payload)
  values (p_trade_id, 'system', p_body, p_event, p_payload);
$$;

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := clock_timestamp();
  if current_user in ('authenticated', 'anon') then
    new.sender_id := auth.uid();
    new.event := null;
    new.payload := null;
    if new.kind = 'system' then
      raise exception 'invalid_message_kind';
    end if;
    if (select count(*) from public.messages m
        where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 20 then
      raise exception 'message_rate_limited';
    end if;
  end if;

  if new.kind = 'text' then
    new.body := private.clean_text(new.body);
  elsif new.kind = 'image' then
    new.body := null;
    if left(coalesce(new.image_path, ''), 37) <> new.trade_id::text || '/' or new.image_path ~ '\.\.' then
      raise exception 'invalid_image_path';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_validate before insert on public.messages
  for each row execute function private.messages_before_insert();

create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades t
  set last_message_at = new.created_at,
      last_message_preview = case
        when new.kind = 'image' then '画像を送信しました'
        else left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 80)
      end,
      buyer_read_at = case when new.sender_id = t.buyer_id then new.created_at else t.buyer_read_at end,
      seller_read_at = case when new.sender_id = t.seller_id then new.created_at else t.seller_read_at end
  where t.id = new.trade_id;
  return null;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function private.messages_after_insert();

-- Chat messages also produce push notifications (system messages come with a notification row instead).
create trigger messages_dispatch after insert on public.messages
  for each row when (new.kind <> 'system') execute function private.dispatch_push();

-- -----------------------------------------------------------------------------
-- Validation helpers
-- -----------------------------------------------------------------------------

-- Normalises and validates [{date, slot}, ...] against the university's time bands.
create or replace function private.validate_slots(p_university_id uuid, p_slots jsonb, p_min int)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ids text[];
  v_today date := private.today_jst();
  v_result jsonb;
begin
  select array_agg(s ->> 'id') into v_ids
  from public.universities u, jsonb_array_elements(u.meetup_slots) s
  where u.id = p_university_id;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'invalid_slots';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_slots) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or not ((e ->> 'slot') = any (v_ids))
  ) then
    raise exception 'invalid_slots';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('date', x.d, 'slot', x.s)
                  order by x.d, array_position(v_ids, x.s)), '[]'::jsonb)
  into v_result
  from (
    select distinct (e ->> 'date')::date as d, e ->> 'slot' as s
    from jsonb_array_elements(p_slots) e
  ) x;

  if exists (
    select 1 from jsonb_array_elements(v_result) e
    where (e ->> 'date')::date < v_today or (e ->> 'date')::date > v_today + 30
  ) then
    raise exception 'invalid_slot_date';
  end if;
  if jsonb_array_length(v_result) < p_min then
    raise exception 'not_enough_slots';
  end if;
  if jsonb_array_length(v_result) > 12 then
    raise exception 'too_many_slots';
  end if;
  return v_result;
end;
$$;

-- Returns {spot_ids: [...], other_place: text|null}.
create or replace function private.validate_spots(p_university_id uuid, p_spot_ids uuid[], p_other_place text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_other text := private.clean_line(p_other_place);
begin
  select coalesce(array_agg(distinct m.id), array[]::uuid[]) into v_ids
  from public.meetup_spots m
  where m.id = any (coalesce(p_spot_ids, array[]::uuid[]))
    and m.university_id = p_university_id
    and m.is_active;

  if cardinality(v_ids) <> cardinality(array(select distinct unnest(coalesce(p_spot_ids, array[]::uuid[])))) then
    raise exception 'invalid_spot';
  end if;
  if v_other is not null and char_length(v_other) > 60 then
    raise exception 'other_place_too_long';
  end if;
  if cardinality(v_ids) = 0 and v_other is null then
    raise exception 'spot_required';
  end if;
  return jsonb_build_object('spot_ids', to_jsonb(v_ids), 'other_place', v_other);
end;
$$;

create or replace function private.lock_trade_for(p_trade_id uuid, p_user_id uuid)
returns public.trades
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade public.trades%rowtype;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.buyer_id, v_trade.seller_id) then
    raise exception 'trade_not_found';
  end if;
  return v_trade;
end;
$$;

create or replace function private.slot_label(p_university_id uuid, p_slot text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select s ->> 'label'
    from public.universities u, jsonb_array_elements(u.meetup_slots) s
    where u.id = p_university_id and s ->> 'id' = p_slot
    limit 1), p_slot);
$$;

create or replace function private.format_meetup(p_date date, p_slot_label text, p_time text)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_date, 'FMMM/FMDD') || '(' ||
    (array['日', '月', '火', '水', '木', '金', '土'])[extract(dow from p_date)::int + 1] || ') ' ||
    coalesce(p_time, p_slot_label);
$$;

-- -----------------------------------------------------------------------------
-- Transitions
-- -----------------------------------------------------------------------------

create or replace function public.request_trade(
  p_item_id uuid,
  p_payment_method text,
  p_slots jsonb,
  p_spot_ids uuid[],
  p_other_place text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_item public.items%rowtype;
  v_seller public.profiles%rowtype;
  v_buyer_name text;
  v_slots jsonb;
  v_spots jsonb;
  v_message text := private.clean_text(p_message);
  v_trade_id uuid;
begin
  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null or v_item.university_id is distinct from public.my_university_id() then
    raise exception 'item_not_found';
  end if;
  if v_item.seller_id = v_uid then
    raise exception 'own_item';
  end if;
  if v_item.status = 'reserved' then
    raise exception 'item_reserved';
  end if;
  if v_item.status <> 'active' then
    raise exception 'item_not_available';
  end if;

  select * into v_seller from public.profiles where id = v_item.seller_id;
  if v_seller.deleted_at is not null or v_seller.listings_paused or not private.is_active_user(v_seller.id) then
    raise exception 'seller_unavailable';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'cashless', 'either') then
    raise exception 'invalid_payment_method';
  end if;
  if (select count(*) from public.trades t
      where t.buyer_id = v_uid and t.status in ('negotiating', 'scheduled')) >= 5 then
    raise exception 'too_many_open_trades';
  end if;
  if (select count(*) from public.trades t
      where t.buyer_id = v_uid and t.created_at > now() - interval '1 day') >= 10 then
    raise exception 'request_rate_limited';
  end if;
  if v_message is not null and char_length(v_message) > 500 then
    raise exception 'message_too_long';
  end if;

  v_slots := private.validate_slots(v_item.university_id, p_slots, 2);
  v_spots := private.validate_spots(v_item.university_id, p_spot_ids, p_other_place);

  insert into public.trades (
    university_id, item_id, seller_id, buyer_id, item_title, item_image, price,
    payment_method, status, proposal, buyer_read_at
  )
  values (
    v_item.university_id, v_item.id, v_item.seller_id, v_uid, v_item.title,
    coalesce(v_item.images -> 0 ->> 'thumb', v_item.images -> 0 ->> 'path'), v_item.price,
    p_payment_method, 'negotiating',
    jsonb_build_object(
      'by', v_uid,
      'slots', v_slots,
      'spot_ids', v_spots -> 'spot_ids',
      'other_place', v_spots -> 'other_place',
      'at', now()),
    now()
  )
  returning id into v_trade_id;

  update public.items set status = 'reserved' where id = v_item.id;

  perform private.post_system_message(v_trade_id, 'requested',
    '取引リクエストが送信されました。出品者が候補から日時と場所を選ぶと確定します。',
    jsonb_build_object('payment_method', p_payment_method, 'price', v_item.price));
  perform private.post_system_message(v_trade_id, 'proposal', '受け渡し候補',
    jsonb_build_object('by', v_uid, 'slots', v_slots, 'spot_ids', v_spots -> 'spot_ids',
                       'other_place', v_spots -> 'other_place'));

  if v_message is not null then
    insert into public.messages (trade_id, sender_id, kind, body)
    values (v_trade_id, v_uid, 'text', v_message);
  end if;

  select p.nickname into v_buyer_name from public.profiles p where p.id = v_uid;
  perform private.notify(v_item.seller_id, 'trade_requested', '取引リクエストが届きました',
    v_buyer_name || 'さんが「' || v_item.title || '」を希望しています。候補から日時と場所を選んでください。',
    '/trades/' || v_trade_id, v_trade_id, v_item.id);

  return v_trade_id;
exception
  when unique_violation then
    raise exception 'item_reserved';
end;
$$;

create or replace function public.propose_meetup(
  p_trade_id uuid,
  p_slots jsonb,
  p_spot_ids uuid[],
  p_other_place text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_trade public.trades%rowtype := private.lock_trade_for(p_trade_id, v_uid);
  v_slots jsonb;
  v_spots jsonb;
  v_note text := private.clean_line(p_note);
  v_other uuid;
  v_previous jsonb;
  v_name text;
begin
  if v_trade.status not in ('negotiating', 'scheduled') then
    raise exception 'trade_not_open';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'note_too_long';
  end if;

  v_slots := private.validate_slots(v_trade.university_id, p_slots, 1);
  v_spots := private.validate_spots(v_trade.university_id, p_spot_ids, p_other_place);
  v_other := case when v_uid = v_trade.buyer_id then v_trade.seller_id else v_trade.buyer_id end;

  if v_trade.status = 'scheduled' then
    v_previous := jsonb_build_object(
      'date', v_trade.meetup_date, 'slot', v_trade.meetup_slot,
      'time', v_trade.meetup_time, 'place', v_trade.meetup_place);
  end if;

  update public.trades
  set status = 'negotiating',
      proposal = jsonb_build_object(
        'by', v_uid,
        'slots', v_slots,
        'spot_ids', v_spots -> 'spot_ids',
        'other_place', v_spots -> 'other_place',
        'note', v_note,
        'at', now()),
      meetup_date = null,
      meetup_slot = null,
      meetup_time = null,
      meetup_spot_id = null,
      meetup_place = null,
      meetup_confirmed_at = null,
      meetup_reminded_on = null
  where id = v_trade.id;

  perform private.post_system_message(v_trade.id, 'proposal',
    case when v_previous is null then '新しい受け渡し候補' else '日程変更の候補' end,
    jsonb_build_object('by', v_uid, 'slots', v_slots, 'spot_ids', v_spots -> 'spot_ids',
                       'other_place', v_spots -> 'other_place', 'note', v_note, 'previous', v_previous));

  select p.nickname into v_name from public.profiles p where p.id = v_uid;
  perform private.notify(v_other, 'meetup_proposed',
    case when v_previous is null then '受け渡し候補が届きました' else '日程変更の相談が届きました' end,
    v_name || 'さんから「' || v_trade.item_title || '」の受け渡し候補が届きました。都合の良い日時を選んでください。',
    '/trades/' || v_trade.id, v_trade.id, v_trade.item_id);
end;
$$;

create or replace function public.confirm_meetup(
  p_trade_id uuid,
  p_date date,
  p_slot text,
  p_spot_id uuid default null,
  p_time text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_trade public.trades%rowtype := private.lock_trade_for(p_trade_id, v_uid);
  v_place text;
  v_time text := nullif(btrim(coalesce(p_time, '')), '');
  v_other uuid;
  v_label text;
  v_when text;
begin
  if v_trade.status <> 'negotiating' or v_trade.proposal is null then
    raise exception 'nothing_to_confirm';
  end if;
  if (v_trade.proposal ->> 'by')::uuid = v_uid then
    raise exception 'cannot_confirm_own_proposal';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_trade.proposal -> 'slots') s
    where (s ->> 'date')::date = p_date and s ->> 'slot' = p_slot
  ) then
    raise exception 'slot_not_in_proposal';
  end if;
  if p_date < private.today_jst() then
    raise exception 'invalid_slot_date';
  end if;

  if p_spot_id is not null then
    if not (v_trade.proposal -> 'spot_ids') ? p_spot_id::text then
      raise exception 'spot_not_in_proposal';
    end if;
    select m.name into v_place from public.meetup_spots m where m.id = p_spot_id;
  else
    v_place := v_trade.proposal ->> 'other_place';
    if v_place is null then
      raise exception 'spot_required';
    end if;
  end if;

  if v_time is not null and (v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_time < '07:00' or v_time > '20:00') then
    raise exception 'invalid_time';
  end if;

  update public.trades
  set status = 'scheduled',
      meetup_date = p_date,
      meetup_slot = p_slot,
      meetup_time = v_time,
      meetup_spot_id = p_spot_id,
      meetup_place = v_place,
      meetup_confirmed_at = now(),
      meetup_reminded_on = null,
      proposal = null
  where id = v_trade.id;

  v_label := private.slot_label(v_trade.university_id, p_slot);
  v_when := private.format_meetup(p_date, v_label, v_time);

  perform private.post_system_message(v_trade.id, 'confirmed', '受け渡し日時が決まりました',
    jsonb_build_object('date', p_date, 'slot', p_slot, 'slot_label', v_label,
                       'time', v_time, 'place', v_place, 'by', v_uid));

  v_other := case when v_uid = v_trade.buyer_id then v_trade.seller_id else v_trade.buyer_id end;
  perform private.notify(v_other, 'meetup_confirmed', '受け渡し日時が決まりました',
    '「' || v_trade.item_title || '」: ' || v_when || ' / ' || v_place,
    '/trades/' || v_trade.id, v_trade.id, v_trade.item_id);
end;
$$;

-- Seller shows this 6-digit code (and QR) at the meet-up; the buyer enters it.
create or replace function public.issue_handover_code(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_trade public.trades%rowtype := private.lock_trade_for(p_trade_id, v_uid);
  v_bytes bytea := extensions.gen_random_bytes(4);
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_uid <> v_trade.seller_id then
    raise exception 'only_seller';
  end if;
  if v_trade.status not in ('negotiating', 'scheduled') then
    raise exception 'trade_not_open';
  end if;

  v_code := lpad((((get_byte(v_bytes, 0)::bigint << 24) | (get_byte(v_bytes, 1)::bigint << 16)
                  | (get_byte(v_bytes, 2)::bigint << 8) | get_byte(v_bytes, 3)::bigint) % 1000000)::text, 6, '0');

  insert into private.handover_codes (trade_id, code, expires_at, attempts, created_at)
  values (v_trade.id, v_code, v_expires, 0, now())
  on conflict (trade_id) do update
    set code = excluded.code, expires_at = excluded.expires_at, attempts = 0, created_at = now();

  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

create or replace function private.mark_handed_over(p_trade_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade public.trades%rowtype;
begin
  update public.trades
  set status = 'handed_over',
      handed_over_at = now(),
      handover_method = p_method,
      buyer_confirmed_at = coalesce(buyer_confirmed_at, now()),
      seller_confirmed_at = coalesce(seller_confirmed_at, now()),
      proposal = null
  where id = p_trade_id
  returning * into v_trade;

  update public.items set status = 'sold', sold_at = now()
  where id = v_trade.item_id and status = 'reserved';

  delete from private.handover_codes where trade_id = p_trade_id;

  perform private.post_system_message(p_trade_id, 'handed_over', '受け渡しが完了しました',
    jsonb_build_object('method', p_method));

  perform private.notify(v_trade.buyer_id, 'handover_done', '受け渡しが完了しました',
    '「' || v_trade.item_title || '」の取引相手を評価してください。', '/trades/' || p_trade_id, p_trade_id, v_trade.item_id);
  perform private.notify(v_trade.seller_id, 'handover_done', '受け渡しが完了しました',
    '「' || v_trade.item_title || '」の取引相手を評価してください。', '/trades/' || p_trade_id, p_trade_id, v_trade.item_id);
end;
$$;

-- Returns {ok} or {ok:false, error, remaining}. Wrong codes are counted (5 tries per code).
create or replace function public.complete_handover(p_trade_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_trade public.trades%rowtype := private.lock_trade_for(p_trade_id, v_uid);
  v_row private.handover_codes%rowtype;
begin
  if v_uid <> v_trade.buyer_id then
    raise exception 'only_buyer';
  end if;
  if v_trade.status in ('handed_over', 'completed') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_trade.status not in ('negotiating', 'scheduled') then
    raise exception 'trade_not_open';
  end if;

  select * into v_row from private.handover_codes where trade_id = v_trade.id for update;
  if v_row.trade_id is null or v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'code_expired');
  end if;
  if v_row.attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;
  if v_row.code <> regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g') then
    update private.handover_codes set attempts = attempts + 1 where trade_id = v_trade.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code', 'remaining', 4 - v_row.attempts);
  end if;

  perform private.mark_handed_over(v_trade.id, 'code');
  return jsonb_build_object('ok', true);
end;
$$;

-- Fallback when the code could not be used: both parties confirm separately.
create or replace function public.confirm_handover(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_trade public.trades%rowtype := private.lock_trade_for(p_trade_id, v_uid);
  v_is_buyer boolean := v_uid = v_trade.buyer_id;
  v_other uuid;
  v_name text;
begin
  if v_trade.status in ('handed_over', 'completed') then
    return jsonb_build_object('both', true, 'already', true);
  end if;
  if v_trade.status not in ('negotiating', 'scheduled') then
    raise exception 'trade_not_open';
  end if;

  if (v_is_buyer and v_trade.buyer_confirmed_at is not null)
     or (not v_is_buyer and v_trade.seller_confirmed_at is not null) then
    return jsonb_build_object('both', false, 'already', true);
  end if;

  if (v_is_buyer and v_trade.seller_confirmed_at is not null)
     or (not v_is_buyer and v_trade.buyer_confirmed_at is not null) then
    perform private.mark_handed_over(v_trade.id, 'mutual');
    return jsonb_build_object('both', true);
  end if;

  update public.trades
  set buyer_confirmed_at = case when v_is_buyer then now() else buyer_confirmed_at end,
      seller_confirmed_at = case when v_is_buyer then seller_confirmed_at else now() end
  where id = v_trade.id;

  v_other := case when v_is_buyer then v_trade.seller_id else v_trade.buyer_id end;
  select p.nickname into v_name from public.profiles p where p.id = v_uid;

  perform private.post_system_message(v_trade.id, 'handover_reported',
    v_name || 'さんが受け渡し完了を報告しました',
    jsonb_build_object('by', v_uid, 'role', case when v_is_buyer then 'buyer' else 'seller' end));
  perform private.notify(v_other, 'handover_reported', '受け渡し完了の確認をお願いします',
    v_name || 'さんが「' || v_trade.item_title || '」の受け渡し完了を報告しました。あなたも確認してください。',
    '/trades/' || v_trade.id, v_trade.id, v_trade.item_id);

  return jsonb_build_object('both', false);
end;
$$;

create or replace function private.finalize_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade public.trades%rowtype;
begin
  update public.trades
  set status = 'completed', completed_at = now()
  where id = p_trade_id and status = 'handed_over'
  returning * into v_trade;

  if v_trade.id is null then
    return;
  end if;

  update public.profiles p
  set rating_good = p.rating_good + case when r.score = 'good' then 1 else 0 end,
      rating_normal = p.rating_normal + case when r.score = 'normal' then 1 else 0 end,
      rating_bad = p.rating_bad + case when r.score = 'bad' then 1 else 0 end
  from public.ratings r
  where r.trade_id = p_trade_id and p.id = r.ratee_id;

  update public.profiles
  set completed_trades = completed_trades + 1
  where id in (v_trade.buyer_id, v_trade.seller_id);

  perform private.post_system_message(p_trade_id, 'completed', '取引が完了しました', null);
  perform private.notify(v_trade.buyer_id, 'trade_completed', '取引が完了しました',
    '「' || v_trade.item_title || '」の取引が完了しました。ご利用ありがとうございました。',
    '/trades/' || p_trade_id, p_trade_id, v_trade.item_id);
  perform private.notify(v_trade.seller_id, 'trade_completed', '取引が完了しました',
    '「' || v_trade.item_title || '」の取引が完了しました。ご利用ありがとうございました。',
    '/trades/' || p_trade_id, p_trade_id, v_trade.item_id);
end;
$$;

create or replace function public.rate_trade(p_trade_id uuid, p_score text, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_active_user();
  v_trade public.trades%rowtype := private.lock_trade_for(p_trade_id, v_uid);
  v_is_buyer boolean := v_uid = v_trade.buyer_id;
  v_comment text := private.clean_text(p_comment);
  v_other uuid;
  v_name text;
begin
  if v_trade.status <> 'handed_over' then
    raise exception 'not_ratable';
  end if;
  if p_score not in ('good', 'normal', 'bad') then
    raise exception 'invalid_score';
  end if;
  if v_comment is not null and char_length(v_comment) > 200 then
    raise exception 'comment_too_long';
  end if;

  v_other := case when v_is_buyer then v_trade.seller_id else v_trade.buyer_id end;

  insert into public.ratings (trade_id, rater_id, ratee_id, rater_role, score, comment)
  values (v_trade.id, v_uid, v_other, case when v_is_buyer then 'buyer' else 'seller' end, p_score, v_comment)
  on conflict (trade_id, rater_id) do nothing;
  if not found then
    raise exception 'already_rated';
  end if;

  if exists (select 1 from public.ratings r where r.trade_id = v_trade.id and r.rater_id = v_other) then
    perform private.finalize_trade(v_trade.id);
    return jsonb_build_object('completed', true);
  end if;

  select p.nickname into v_name from public.profiles p where p.id = v_uid;
  perform private.post_system_message(v_trade.id, 'rated', v_name || 'さんが評価しました',
    jsonb_build_object('by', v_uid));
  perform private.notify(v_other, 'rating_received', '取引相手が評価しました',
    'あなたも「' || v_trade.item_title || '」の取引相手を評価してください。評価は双方がそろうと公開されます。',
    '/trades/' || v_trade.id, v_trade.id, v_trade.item_id);
  return jsonb_build_object('completed', false);
end;
$$;

-- Shared by member cancellation, expiry, account deletion and admins.
create or replace function private.cancel_trade_internal(
  p_trade_id uuid,
  p_actor uuid,
  p_reason text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade public.trades%rowtype;
  v_item_status text;
  v_text text;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null or v_trade.status not in ('negotiating', 'scheduled') then
    raise exception 'trade_not_cancellable';
  end if;

  update public.trades
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_actor,
      cancel_reason = p_reason,
      cancel_note = p_note,
      proposal = null
  where id = p_trade_id;

  delete from private.handover_codes where trade_id = p_trade_id;

  v_item_status := case
    when p_reason in ('seller_withdrew', 'expired_after_meetup') then 'hidden'
    when p_reason = 'account_deleted' and p_actor = v_trade.seller_id then 'removed'
    else 'active'
  end;
  update public.items set status = v_item_status where id = v_trade.item_id and status = 'reserved';

  v_text := case p_reason
    when 'schedule_mismatch' then '日程が合わなかったため'
    when 'buyer_withdrew' then '購入者が購入を取りやめたため'
    when 'seller_withdrew' then '出品者が出品を取りやめたため'
    when 'no_response' then '相手からの返信がないため'
    when 'expired' then '一定期間やり取りがなかったため'
    when 'expired_after_meetup' then '受け渡し予定日を過ぎても完了の確認がなかったため'
    when 'account_deleted' then '取引相手が退会したため'
    when 'admin' then '運営の判断により'
    else 'その他の理由により'
  end;

  perform private.post_system_message(p_trade_id, 'cancelled', v_text || '取引はキャンセルされました',
    jsonb_build_object('reason', p_reason, 'note', p_note, 'by', p_actor));

  if p_actor is null or p_actor <> v_trade.buyer_id then
    perform private.notify(v_trade.buyer_id, 'trade_cancelled', '取引がキャンセルされました',
      '「' || v_trade.item_title || '」: ' || v_text || 'キャンセルされました。',
      '/trades/' || p_trade_id, p_trade_id, v_trade.item_id);
  end if;
  if p_actor is null or p_actor <> v_trade.seller_id then
    perform private.notify(v_trade.seller_id, 'trade_cancelled', '取引がキャンセルされました',
      '「' || v_trade.item_title || '」: ' || v_text || 'キャンセルされました。'
        || case when v_item_status = 'active' then '商品は再び出品中になりました。' else '' end,
      '/trades/' || p_trade_id, p_trade_id, v_trade.item_id);
  end if;

  -- Members who saved the item hear that it is available again.
  if v_item_status = 'active' then
    insert into public.notifications (user_id, type, title, body, link, item_id)
    select f.user_id, 'item_available', 'いいねした本が購入できるようになりました',
           '「' || v_trade.item_title || '」が再び出品中になりました。',
           '/items/' || v_trade.item_id, v_trade.item_id
    from public.favorites f
    join public.profiles p on p.id = f.user_id and p.deleted_at is null
    where f.item_id = v_trade.item_id and f.user_id <> v_trade.buyer_id;
  end if;
end;
$$;

create or replace function public.cancel_trade(p_trade_id uuid, p_reason text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_note text := private.clean_text(p_note);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_trade := private.lock_trade_for(p_trade_id, v_uid);

  if p_reason not in ('schedule_mismatch', 'buyer_withdrew', 'seller_withdrew', 'no_response', 'other') then
    raise exception 'invalid_reason';
  end if;
  if (p_reason = 'buyer_withdrew' and v_uid <> v_trade.buyer_id)
     or (p_reason = 'seller_withdrew' and v_uid <> v_trade.seller_id) then
    raise exception 'invalid_reason';
  end if;
  if p_reason = 'other' and (v_note is null or char_length(v_note) < 4) then
    raise exception 'note_required';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'note_too_long';
  end if;

  perform private.cancel_trade_internal(p_trade_id, v_uid, p_reason, v_note);
end;
$$;

create or replace function public.mark_trade_read(p_trade_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.trades
  set buyer_read_at = case when buyer_id = auth.uid() then now() else buyer_read_at end,
      seller_read_at = case when seller_id = auth.uid() then now() else seller_read_at end
  where id = p_trade_id and auth.uid() in (buyer_id, seller_id);
$$;

-- -----------------------------------------------------------------------------
-- Read models
-- -----------------------------------------------------------------------------

create or replace view public.my_trades
with (security_invoker = true) as
select
  t.id,
  t.university_id,
  t.item_id,
  t.seller_id,
  t.buyer_id,
  t.item_title,
  t.item_image,
  t.price,
  t.payment_method,
  t.status,
  t.proposal,
  t.meetup_date,
  t.meetup_slot,
  t.meetup_time,
  t.meetup_place,
  t.buyer_confirmed_at,
  t.seller_confirmed_at,
  t.handed_over_at,
  t.completed_at,
  t.cancelled_at,
  t.cancel_reason,
  t.last_message_at,
  t.last_message_preview,
  t.created_at,
  case when t.buyer_id = auth.uid() then 'buyer' else 'seller' end as my_role,
  cp.id as counterpart_id,
  cp.nickname as counterpart_nickname,
  cp.avatar_path as counterpart_avatar_path,
  (
    select count(*)::int
    from public.messages m
    where m.trade_id = t.id
      and m.sender_id is distinct from auth.uid()
      and m.created_at > coalesce(case when t.buyer_id = auth.uid() then t.buyer_read_at else t.seller_read_at end,
                                  '-infinity'::timestamptz)
  ) as unread_count,
  exists (select 1 from public.ratings r where r.trade_id = t.id and r.rater_id = auth.uid()) as i_rated
from public.trades t
join public.profiles cp on cp.id = case when t.buyer_id = auth.uid() then t.seller_id else t.buyer_id end
where auth.uid() in (t.buyer_id, t.seller_id);

create or replace function public.get_badge_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'notifications', (
      select count(*) from public.notifications n
      where n.user_id = auth.uid() and n.read_at is null),
    'trades', (
      select count(*) from public.trades t
      where auth.uid() in (t.buyer_id, t.seller_id)
        and t.status in ('negotiating', 'scheduled', 'handed_over')
        and exists (
          select 1 from public.messages m
          where m.trade_id = t.id
            and m.sender_id is distinct from auth.uid()
            and m.created_at > coalesce(case when t.buyer_id = auth.uid() then t.buyer_read_at else t.seller_read_at end,
                                        '-infinity'::timestamptz)))
  );
$$;

-- Public reviews of a member (finalised trades at my university only).
create or replace function public.user_reviews(p_user_id uuid, p_limit int default 20)
returns table (
  score text,
  comment text,
  rater_role text,
  rater_nickname text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.score, r.comment, r.rater_role, p.nickname, r.created_at
  from public.ratings r
  join public.trades t on t.id = r.trade_id
  join public.profiles p on p.id = r.rater_id
  where r.ratee_id = p_user_id
    and t.status = 'completed'
    and t.university_id = public.my_university_id()
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.trades enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;
alter table private.handover_codes enable row level security;

create policy trades_participants_read on public.trades for select to authenticated
  using (
    (select auth.uid()) in (buyer_id, seller_id)
    or (select public.is_platform_admin())
  );

create policy messages_participants_read on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id and (select auth.uid()) in (t.buyer_id, t.seller_id)
    )
    or (select public.is_platform_admin())
  );

create policy messages_participants_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind in ('text', 'image')
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and (select auth.uid()) in (t.buyer_id, t.seller_id)
        and t.status in ('negotiating', 'scheduled', 'handed_over')
    )
    and private.is_active_user((select auth.uid()))
  );

-- Scores stay private until the trade is finalised (prevents retaliation).
-- Other members read reviews through public.user_reviews().
create policy ratings_read on public.ratings for select to authenticated
  using (
    rater_id = (select auth.uid())
    or (
      ratee_id = (select auth.uid())
      and exists (select 1 from public.trades t where t.id = trade_id and t.status = 'completed')
    )
    or (select public.is_platform_admin())
  );

revoke all on public.trades, public.messages, public.ratings, public.my_trades from anon, authenticated;
grant select on public.trades, public.messages, public.ratings, public.my_trades to authenticated;
grant insert (trade_id, kind, body, image_path) on public.messages to authenticated;
grant all on public.trades, public.messages, public.ratings, public.my_trades to service_role;

revoke execute on function
  public.request_trade(uuid, text, jsonb, uuid[], text, text),
  public.propose_meetup(uuid, jsonb, uuid[], text, text),
  public.confirm_meetup(uuid, date, text, uuid, text),
  public.issue_handover_code(uuid),
  public.complete_handover(uuid, text),
  public.confirm_handover(uuid),
  public.rate_trade(uuid, text, text),
  public.cancel_trade(uuid, text, text),
  public.mark_trade_read(uuid),
  public.get_badge_counts(),
  public.user_reviews(uuid, int)
from public;
grant execute on function
  public.request_trade(uuid, text, jsonb, uuid[], text, text),
  public.propose_meetup(uuid, jsonb, uuid[], text, text),
  public.confirm_meetup(uuid, date, text, uuid, text),
  public.issue_handover_code(uuid),
  public.complete_handover(uuid, text),
  public.confirm_handover(uuid),
  public.rate_trade(uuid, text, text),
  public.cancel_trade(uuid, text, text),
  public.mark_trade_read(uuid),
  public.get_badge_counts(),
  public.user_reviews(uuid, int)
to authenticated;
