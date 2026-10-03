-- End-to-end checks of tenancy, RLS and the trade state machine.
-- Run: npm run db:test   (everything happens in one transaction that is rolled back)
\set ON_ERROR_STOP 1
set client_min_messages = notice;
begin;

-- ---------------------------------------------------------------- helpers ----
create function pg_temp.login(p_email text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform set_config('role', 'postgres', true);
  select id into v_id from auth.users where email = p_email;
  if v_id is null then raise exception 'no such test user %', p_email; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
  return v_id;
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAILED: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;

create function pg_temp.expect_error(p_sql text, p_expected text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAILED (no error raised): %', p_label;
exception
  when others then
    if sqlerrm like 'FAILED%' then raise; end if;
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'FAILED: % (got: %)', p_label, sqlerrm;
    end if;
    raise notice 'ok - % [%]', p_label, sqlerrm;
end $$;

create temp table t_ids (k text primary key, v uuid);
create temp table t_vals (k text primary key, v text);
grant all on t_ids, t_vals to authenticated;

create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from t_ids where k = p_key $$;
create function pg_temp.slots(p_days int[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('date', (private.today_jst() + d)::text, 'slot', 'lunch'))
  from unnest(p_days) d
$$;

-- --------------------------------------------------------- sign-up rules ----
select pg_temp.check((public.check_signup_email('a@st.alpha-u.ac.jp') ->> 'ok')::boolean
  and (public.check_signup_email('a@st.alpha-u.ac.jp') -> 'university' ->> 'is_new')::boolean,
  'unknown *.ac.jp domain is accepted as a new group');
select pg_temp.check(public.check_signup_email('a@gmail.com') ->> 'reason' = 'unsupported',
  'gmail is rejected');
select pg_temp.check(public.check_signup_email('a@m.isct.ac.jp') ->> 'reason' = 'external',
  'Science Tokyo addresses are sent to the existing service');
select pg_temp.check(public.check_signup_email('a@g.ecc.u-tokyo.ac.jp') -> 'university' ->> 'name' = '東京大学',
  'subdomain resolves to the seeded university');
select pg_temp.check(public.check_signup_email('a@fuji.waseda.jp') -> 'university' ->> 'name' = '早稲田大学',
  'non-ac.jp domain from the directory works');
select pg_temp.check(public.hook_before_user_created('{"user":{"email":"x@gmail.com"}}'::jsonb) ? 'error',
  'auth hook rejects unsupported domains');
select pg_temp.check(public.hook_before_user_created('{"user":{"email":"x@st.alpha-u.ac.jp"}}'::jsonb) = '{}'::jsonb,
  'auth hook accepts campus domains');
select pg_temp.expect_error($$insert into auth.users (id, email) values (gen_random_uuid(), 'x@gmail.com')$$,
  'sign-up rejected', 'trigger blocks gmail even without the hook');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       e, '', now(), '{}', '{}', now(), now()
from unnest(array['alice@st.alpha-u.ac.jp', 'bob@alpha-u.ac.jp', 'erin@alpha-u.ac.jp', 'carol@beta-u.ac.jp']) e;

-- -------------------------------------------------------------- profiles ----
select pg_temp.login('alice@st.alpha-u.ac.jp');
select pg_temp.check((public.get_my_context() -> 'profile') = 'null'::jsonb, 'context before onboarding has no profile');
select public.complete_profile('アリス', '工学部', '機械工学科', 'B2', null, '2026-10-03', 'アルファ大学');
select pg_temp.login('bob@alpha-u.ac.jp');
select pg_temp.expect_error($$select public.complete_profile('アリス', '理学部', null, 'B3', null, '2026-10-03')$$,
  'nickname_taken', 'nicknames are unique per university');
select public.complete_profile('ボブ', '理学部', null, 'B3', null, '2026-10-03');
select pg_temp.login('erin@alpha-u.ac.jp');
select public.complete_profile('エリン', '工学部', null, 'M1', null, '2026-10-03');
select pg_temp.login('carol@beta-u.ac.jp');
select public.complete_profile('アリス', '文学部', null, 'B1', null, '2026-10-03');

select pg_temp.logout();
select pg_temp.check((select count(distinct university_id) from public.profiles where nickname in ('ボブ', 'エリン')) = 1,
  'same registrable domain → same university');
select pg_temp.check(
  (select count(distinct p.university_id) from public.profiles p join auth.users u on u.id = p.id
   where u.email in ('alice@st.alpha-u.ac.jp', 'bob@alpha-u.ac.jp', 'erin@alpha-u.ac.jp', 'carol@beta-u.ac.jp')) = 2,
  'beta-u is a separate university');
select pg_temp.check(
  (select u.name from public.universities u join public.university_domains d on d.university_id = u.id
   where d.domain = 'alpha-u.ac.jp') = 'alpha-u.ac.jp', 'auto-created group is named after its domain');
select pg_temp.check(exists (select 1 from public.university_name_suggestions where name = 'アルファ大学'),
  'name suggestion recorded for admins');
select pg_temp.check((select count(*) from public.meetup_spots m join public.university_domains d
                      on d.university_id = m.university_id where d.domain = 'alpha-u.ac.jp') = 4,
  'default hand-over spots created');

-- ----------------------------------------------------------------- items ----
select pg_temp.login('alice@st.alpha-u.ac.jp');
with x as (
  insert into public.items (title, author, isbn, condition, list_price, price, images)
  values ('線形代数入門', '齋藤正彦', '9784130620017', 'good', 3490, 1040,
          jsonb_build_array(jsonb_build_object('path', public.my_university_id() || '/' || auth.uid() || '/a.webp')))
  returning id
)
insert into t_ids select 'item1', id from x;
select pg_temp.check(
  (select price from public.items where id = pg_temp.id('item1')) = 1040, 'listing at the 30% cap (floored to 10 yen)');
select pg_temp.expect_error($$
  insert into public.items (title, condition, list_price, price, images)
  values ('x', 'good', 3490, 1050, jsonb_build_array(jsonb_build_object('path', public.my_university_id() || '/' || auth.uid() || '/b.webp')))
$$, 'price_above_cap', 'price above the cap is rejected');
select pg_temp.expect_error($$
  insert into public.items (title, condition, list_price, price, images)
  values ('x', 'good', 1000, 300, '[{"path": "someone-else/x.webp"}]'::jsonb)
$$, 'invalid_image_path', 'images must live in the seller''s folder');
select pg_temp.expect_error($$
  update public.items set status = 'sold' where id = pg_temp.id('item1')
$$, 'invalid_status', 'sellers cannot mark items sold directly');

select pg_temp.login('bob@alpha-u.ac.jp');
select pg_temp.check((select count(*) from public.market_items) = 1, 'same-university member sees the listing');
select pg_temp.check(
  (select count(*) from public.search_items('線形')) = 1 and (select count(*) from public.search_items('齋藤 入門')) = 1,
  'search matches title and multiple terms');
select pg_temp.check((select count(*) from public.search_items('978-4-13-062001-7')) = 1, 'search by hyphenated ISBN');
update public.items set title = 'hacked' where id = pg_temp.id('item1');
select pg_temp.check((select title from public.items where id = pg_temp.id('item1')) = '線形代数入門',
  'others cannot edit a listing');

select pg_temp.login('carol@beta-u.ac.jp');
select pg_temp.check((select count(*) from public.items) = 0, 'other university cannot see the listing');
select pg_temp.check((select count(*) from public.profiles) = 1, 'other university cannot see profiles');
select pg_temp.expect_error($$insert into public.favorites (user_id, item_id) values (auth.uid(), pg_temp.id('item1'))$$,
  'row-level security', 'cannot favourite across universities');
select pg_temp.expect_error(format($$select public.request_trade(%L, 'cash', pg_temp.slots(array[1, 2]), array[]::uuid[], 'x')$$,
  pg_temp.id('item1')), 'item_not_found', 'cannot request across universities');

-- ---------------------------------------------------------------- trades ----
select pg_temp.login('bob@alpha-u.ac.jp');
insert into t_ids select 'spot', id from public.meetup_spots
  where university_id = public.my_university_id() order by sort_order limit 1;
select pg_temp.expect_error(format($$select public.request_trade(%L, 'cash', pg_temp.slots(array[1]), array[%L]::uuid[])$$,
  pg_temp.id('item1'), pg_temp.id('spot')), 'not_enough_slots', 'a request needs at least two time slots');
select pg_temp.expect_error(format($$select public.request_trade(%L, 'cash', pg_temp.slots(array[1, 2]), array[]::uuid[])$$,
  pg_temp.id('item1')), 'spot_required', 'a request needs a place');
insert into t_ids values ('trade1', public.request_trade(pg_temp.id('item1'), 'cash', pg_temp.slots(array[1, 2]),
  array[pg_temp.id('spot')], null, 'よろしくお願いします'));
select pg_temp.check((select status from public.items where id = pg_temp.id('item1')) = 'reserved', 'item is reserved');
select pg_temp.check((select count(*) from public.messages where trade_id = pg_temp.id('trade1')) = 3,
  'request posts system messages and the buyer''s note');
select pg_temp.expect_error(format($$update public.trades set status = 'completed' where id = %L$$, pg_temp.id('trade1')),
  'permission denied', 'trades cannot be written directly');
select pg_temp.expect_error(format($$select public.confirm_meetup(%L, private.today_jst() + 1, 'lunch', %L)$$,
  pg_temp.id('trade1'), pg_temp.id('spot')), 'cannot_confirm_own_proposal', 'proposer cannot confirm their own proposal');

select pg_temp.login('erin@alpha-u.ac.jp');
select pg_temp.expect_error(format($$select public.request_trade(%L, 'cash', pg_temp.slots(array[1, 2]), array[%L]::uuid[])$$,
  pg_temp.id('item1'), pg_temp.id('spot')), 'item_reserved', 'second buyer is told the item is reserved');
select pg_temp.check((select count(*) from public.trades) = 0, 'non-participants cannot see the trade');

select pg_temp.login('alice@st.alpha-u.ac.jp');
select pg_temp.check((select (public.get_badge_counts() ->> 'notifications')::int) = 1, 'seller is notified of the request');
select pg_temp.expect_error(format($$select public.confirm_meetup(%L, private.today_jst() + 5, 'lunch', %L)$$,
  pg_temp.id('trade1'), pg_temp.id('spot')), 'slot_not_in_proposal', 'only proposed slots can be confirmed');
select public.confirm_meetup(pg_temp.id('trade1'), private.today_jst() + 1, 'lunch', pg_temp.id('spot'), '12:30');
select pg_temp.check((select status from public.trades where id = pg_temp.id('trade1')) = 'scheduled', 'meet-up confirmed');
insert into t_vals values ('code', public.issue_handover_code(pg_temp.id('trade1')) ->> 'code');

select pg_temp.login('bob@alpha-u.ac.jp');
select pg_temp.expect_error($$select * from private.handover_codes$$, 'permission denied', 'buyer cannot read hand-over codes');
select pg_temp.check(
  public.complete_handover(pg_temp.id('trade1'), lpad(((((select v from t_vals where k = 'code')::int) + 1) % 1000000)::text, 6, '0')) ->> 'error' = 'invalid_code',
  'wrong code is refused');
select pg_temp.check((public.complete_handover(pg_temp.id('trade1'), (select v from t_vals where k = 'code')) ->> 'ok')::boolean,
  'correct code completes the hand-over');
select pg_temp.check((select status from public.trades where id = pg_temp.id('trade1')) = 'handed_over', 'trade awaits ratings');
select pg_temp.check((select status from public.items where id = pg_temp.id('item1')) = 'sold', 'item is sold');
select pg_temp.check(not (public.rate_trade(pg_temp.id('trade1'), 'good', 'ありがとうございました') ->> 'completed')::boolean,
  'first rating keeps the trade open');
insert into public.messages (trade_id, kind, body) values (pg_temp.id('trade1'), 'text', 'ありがとうございました！');

select pg_temp.login('alice@st.alpha-u.ac.jp');
select pg_temp.check((select count(*) from public.ratings) = 0, 'scores stay hidden until both have rated');
select pg_temp.check((public.rate_trade(pg_temp.id('trade1'), 'good') ->> 'completed')::boolean, 'second rating completes the trade');
select pg_temp.check((select rating_good = 1 and completed_trades = 1 from public.profiles where id = auth.uid()),
  'reputation counters updated');

select pg_temp.login('carol@beta-u.ac.jp');
select pg_temp.expect_error(format($$insert into public.messages (trade_id, kind, body) values (%L, 'text', 'hi')$$, pg_temp.id('trade1')),
  'row-level security', 'outsiders cannot post into a trade');

select pg_temp.login('bob@alpha-u.ac.jp');
select pg_temp.check((select count(*) from public.user_reviews(
  (select seller_id from public.trades where id = pg_temp.id('trade1')))) = 1, 'review is public after completion');

-- ------------------------------------------- cancellation & wish alerts ----
select pg_temp.login('erin@alpha-u.ac.jp');
insert into public.wishes (isbn, label) values ('9784000000001', '解析入門');
select pg_temp.login('carol@beta-u.ac.jp');
insert into public.wishes (keyword, label) values ('解析', '解析');

select pg_temp.login('alice@st.alpha-u.ac.jp');
with x as (
  insert into public.items (title, isbn, condition, list_price, price, images)
  values ('解析入門', '9784000000001', 'fair', 2800, 500,
          jsonb_build_array(jsonb_build_object('path', public.my_university_id() || '/' || auth.uid() || '/c.webp')))
  returning id
)
insert into t_ids select 'item2', id from x;

select pg_temp.login('erin@alpha-u.ac.jp');
select pg_temp.check(exists (select 1 from public.notifications where type = 'wish_match'), 'wish alert delivered');
insert into public.favorites (user_id, item_id) values (auth.uid(), pg_temp.id('item2'));

select pg_temp.login('carol@beta-u.ac.jp');
select pg_temp.check(not exists (select 1 from public.notifications where type = 'wish_match'),
  'wish alerts never cross universities');

select pg_temp.login('bob@alpha-u.ac.jp');
insert into t_ids values ('trade2', public.request_trade(pg_temp.id('item2'), 'either', pg_temp.slots(array[1, 3]),
  array[pg_temp.id('spot')]));
select pg_temp.expect_error(format($$select public.cancel_trade(%L, 'seller_withdrew')$$, pg_temp.id('trade2')),
  'invalid_reason', 'buyer cannot use the seller''s reason');
select public.cancel_trade(pg_temp.id('trade2'), 'buyer_withdrew');
select pg_temp.check((select status from public.items where id = pg_temp.id('item2')) = 'active', 'cancelled item is back on sale');

select pg_temp.login('erin@alpha-u.ac.jp');
select pg_temp.check(exists (select 1 from public.notifications where type = 'item_available'),
  'people who liked it hear it is available again');

select pg_temp.login('bob@alpha-u.ac.jp');
select pg_temp.expect_error($$select public.admin_dashboard()$$, 'admin_only', 'admin RPCs are closed to members');

-- ----------------------------------------------------------------- admin ----
select pg_temp.logout();
insert into public.admin_email_allowlist (email) values ('qa-admin@example.com');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'qa-admin@example.com', '', now(), '{}', '{}', now(), now());
insert into t_ids select 'alpha_u', university_id from public.university_domains where domain = 'alpha-u.ac.jp';
insert into t_ids select 'beta_u', university_id from public.university_domains where domain = 'beta-u.ac.jp';
select pg_temp.login('qa-admin@example.com');
select public.admin_apply_university_name(pg_temp.id('alpha_u'), 'アルファ大学（検証）');
select pg_temp.check((select name_verified from public.universities where id = pg_temp.id('alpha_u')), 'admin confirms a group name');
select pg_temp.expect_error($$select public.admin_apply_university_name(pg_temp.id('beta_u'), 'ｱﾙﾌｧ大学(検証)')$$,
  'university_name_taken', 'two universities cannot share a name (width/case-insensitive)');

-- -------------------------------------------------------------- lifecycle ----
select pg_temp.logout();
select pg_temp.check((private.run_maintenance() ? 'expired'), 'maintenance job runs');
select pg_temp.check((select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
                      and tablename in ('messages', 'trades', 'notifications')) = 3, 'realtime publication configured');
delete from auth.users where email = 'carol@beta-u.ac.jp';
select pg_temp.check((select deleted_at is not null and nickname = '退会したユーザー'
                      from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)),
  'deleting the auth user anonymises the profile');
select pg_temp.check(not exists (select 1 from public.wishes w join public.profiles p on p.id = w.user_id where p.deleted_at is not null),
  'personal data of deleted accounts is removed');

\echo ALL CHECKS PASSED
rollback;
