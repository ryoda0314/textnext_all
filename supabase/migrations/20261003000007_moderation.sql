-- =============================================================================
-- Reports, inquiries (お問い合わせ), and the admin console RPCs.
-- Admin functions run with the admin's own session and check is_platform_admin().
-- =============================================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete set null,
  reporter_id uuid not null references public.profiles(id),
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  detail text,
  status text not null default 'open',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  constraint reports_target_values check (target_type in ('item', 'user', 'trade')),
  constraint reports_reason_values check (reason in
    ('prohibited_item', 'misleading', 'harassment', 'no_show', 'external_contact', 'spam', 'other')),
  constraint reports_detail_length check (detail is null or char_length(detail) <= 1000),
  constraint reports_status_values check (status in ('open', 'resolved', 'dismissed'))
);
create index reports_status_idx on public.reports (status, created_at desc);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  university_id uuid references public.universities(id) on delete set null,
  email text,
  category text not null,
  body text not null,
  status text not null default 'open',
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint inquiries_category_values check (category in ('account', 'trade', 'bug', 'university', 'request', 'other')),
  constraint inquiries_body_length check (char_length(body) between 10 and 2000),
  constraint inquiries_reply_length check (reply is null or char_length(reply) <= 2000),
  constraint inquiries_status_values check (status in ('open', 'answered', 'closed')),
  constraint inquiries_contact check (user_id is not null or email is not null)
);
create index inquiries_status_idx on public.inquiries (status, created_at desc);
create index inquiries_user_idx on public.inquiries (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Member RPCs
-- -----------------------------------------------------------------------------

create or replace function public.submit_report(p_target_type text, p_target_id uuid, p_reason text, p_detail text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_university_id uuid := public.my_university_id();
  v_detail text := private.clean_text(p_detail);
  v_ok boolean;
  v_id uuid;
begin
  if v_uid is null or v_university_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.reports r where r.reporter_id = v_uid and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'report_rate_limited';
  end if;

  v_ok := case p_target_type
    when 'item' then exists (select 1 from public.items i where i.id = p_target_id and i.university_id = v_university_id)
    when 'user' then exists (select 1 from public.profiles p where p.id = p_target_id and p.university_id = v_university_id and p.id <> v_uid)
    when 'trade' then exists (select 1 from public.trades t where t.id = p_target_id and v_uid in (t.buyer_id, t.seller_id))
    else false
  end;
  if not coalesce(v_ok, false) then
    raise exception 'report_target_not_found';
  end if;

  insert into public.reports (university_id, reporter_id, target_type, target_id, reason, detail)
  values (v_university_id, v_uid, p_target_type, p_target_id, p_reason, left(v_detail, 1000))
  returning id into v_id;
  return v_id;
end;
$$;

-- Works for guests too (they must leave an email address for the reply).
create or replace function public.submit_inquiry(p_category text, p_body text, p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_body text := private.clean_text(p_body);
  v_id uuid;
begin
  if v_uid is not null then
    select u.email into v_email from auth.users u where u.id = v_uid;
  elsif v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'email_required';
  end if;

  if (select count(*) from public.inquiries i
      where (i.user_id = v_uid or i.email = v_email) and i.created_at > now() - interval '1 day') >= 5 then
    raise exception 'inquiry_rate_limited';
  end if;

  insert into public.inquiries (user_id, university_id, email, category, body)
  values (v_uid, public.my_university_id(), v_email, p_category, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin RPCs
-- -----------------------------------------------------------------------------

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'universities', (select count(*) from public.universities where status = 'active'),
      'members', (select count(*) from public.profiles where deleted_at is null),
      'active_items', (select count(*) from public.items where status = 'active'),
      'open_trades', (select count(*) from public.trades where status in ('negotiating', 'scheduled', 'handed_over')),
      'completed_trades', (select count(*) from public.trades where status = 'completed'),
      'open_reports', (select count(*) from public.reports where status = 'open'),
      'open_inquiries', (select count(*) from public.inquiries where status = 'open'),
      'pending_names', (select count(distinct s.university_id) from public.university_name_suggestions s
                        join public.universities u on u.id = s.university_id where not u.name_verified),
      'university_requests', (select count(*) from public.university_requests where created_at > now() - interval '30 days')
    ),
    'universities', coalesce((
      select jsonb_agg(row_to_json(x) order by x.members desc, x.name)
      from (
        select u.id, u.slug, u.name, u.status, u.name_verified, u.is_auto_created, u.created_at,
          (select count(*) from public.profiles p where p.university_id = u.id and p.deleted_at is null) as members,
          (select count(*) from public.profiles p where p.university_id = u.id and p.deleted_at is null
             and p.created_at > now() - interval '7 days') as new_members_7d,
          (select count(*) from public.items i where i.university_id = u.id and i.status = 'active') as active_items,
          (select count(*) from public.trades t where t.university_id = u.id and t.status = 'completed') as completed_trades,
          (select array_agg(d.domain order by d.domain) from public.university_domains d where d.university_id = u.id) as domains
        from public.universities u
      ) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_university_detail(p_university_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return (
    select jsonb_build_object(
      'university', to_jsonb(u),
      'domains', coalesce((select jsonb_agg(to_jsonb(d) order by d.domain) from public.university_domains d where d.university_id = u.id), '[]'::jsonb),
      'campuses', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order, c.name) from public.campuses c where c.university_id = u.id), '[]'::jsonb),
      'spots', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order, m.name) from public.meetup_spots m where m.university_id = u.id), '[]'::jsonb),
      'name_suggestions', coalesce((
        select jsonb_agg(jsonb_build_object('name', s.name, 'count', s.n) order by s.n desc)
        from (select name, count(*) as n from public.university_name_suggestions
              where university_id = u.id group by name) s), '[]'::jsonb),
      'members', (select count(*) from public.profiles p where p.university_id = u.id and p.deleted_at is null)
    )
    from public.universities u
    where u.id = p_university_id
  );
end;
$$;

create or replace function public.admin_save_university(
  p_id uuid,
  p_name text,
  p_short_name text,
  p_slug text,
  p_status text,
  p_external_url text,
  p_price_cap_percent int,
  p_meetup_slots jsonb,
  p_calil_system_id text,
  p_name_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_admin();

  if p_id is null then
    insert into public.universities (slug, name, short_name, status, external_url, price_cap_percent,
      calil_system_id, name_verified)
    values (lower(btrim(p_slug)), btrim(p_name), private.clean_line(p_short_name), coalesce(p_status, 'active'),
      private.clean_line(p_external_url), coalesce(p_price_cap_percent, 30),
      private.clean_line(p_calil_system_id), coalesce(p_name_verified, true))
    returning id into v_id;
    if p_meetup_slots is not null then
      update public.universities set meetup_slots = p_meetup_slots where id = v_id;
    end if;
    perform private.seed_default_spots(v_id);
    return v_id;
  end if;

  update public.universities
  set name = btrim(p_name),
      short_name = private.clean_line(p_short_name),
      slug = lower(btrim(p_slug)),
      status = p_status,
      external_url = private.clean_line(p_external_url),
      price_cap_percent = p_price_cap_percent,
      meetup_slots = coalesce(p_meetup_slots, meetup_slots),
      calil_system_id = private.clean_line(p_calil_system_id),
      name_verified = p_name_verified
  where id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'university_not_found';
  end if;
  return v_id;
exception
  when unique_violation then
    if sqlerrm like '%universities_name_unique%' then
      raise exception 'university_name_taken';
    elsif sqlerrm like '%universities_slug_key%' then
      raise exception 'university_slug_taken';
    end if;
    raise;
end;
$$;

create or replace function public.admin_set_domain(p_domain text, p_university_id uuid, p_include_subdomains boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  insert into public.university_domains (domain, university_id, include_subdomains)
  values (lower(btrim(p_domain)), p_university_id, coalesce(p_include_subdomains, true))
  on conflict (domain) do update
    set university_id = excluded.university_id, include_subdomains = excluded.include_subdomains;
end;
$$;

create or replace function public.admin_remove_domain(p_domain text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  delete from public.university_domains where domain = lower(btrim(p_domain));
end;
$$;

-- Moves everything from one university group into another (e.g. an auto-created
-- duplicate) and deletes the source. Nicknames that collide get a short suffix.
create or replace function public.admin_merge_universities(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if p_source = p_target or p_source is null or p_target is null then
    raise exception 'invalid_merge';
  end if;
  if not exists (select 1 from public.universities where id = p_source)
     or not exists (select 1 from public.universities where id = p_target) then
    raise exception 'university_not_found';
  end if;

  update public.profiles s
  set nickname = left(s.nickname, 16) || '_' || left(replace(s.id::text, '-', ''), 3)
  where s.university_id = p_source
    and s.deleted_at is null
    and exists (
      select 1 from public.profiles t
      where t.university_id = p_target and t.deleted_at is null and lower(t.nickname) = lower(s.nickname)
    );

  update public.campuses s
  set name = left(s.name, 36) || ' (2)'
  where s.university_id = p_source
    and exists (select 1 from public.campuses t where t.university_id = p_target and t.name = s.name);

  update public.university_domains set university_id = p_target where university_id = p_source;
  update public.campuses set university_id = p_target where university_id = p_source;
  update public.meetup_spots set university_id = p_target where university_id = p_source;
  update public.profiles set university_id = p_target where university_id = p_source;
  update public.items set university_id = p_target where university_id = p_source;
  update public.trades set university_id = p_target where university_id = p_source;
  update public.wishes set university_id = p_target where university_id = p_source;
  update public.reports set university_id = p_target where university_id = p_source;
  update public.inquiries set university_id = p_target where university_id = p_source;
  update public.signup_email_overrides set university_id = p_target where university_id = p_source;
  delete from public.university_name_suggestions where university_id = p_source;
  delete from public.universities where id = p_source;
end;
$$;

create or replace function public.admin_save_campus(p_id uuid, p_university_id uuid, p_name text, p_sort_order int, p_is_active boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_admin();
  if p_id is null then
    insert into public.campuses (university_id, name, sort_order, is_active)
    values (p_university_id, btrim(p_name), coalesce(p_sort_order, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update public.campuses
    set name = btrim(p_name), sort_order = coalesce(p_sort_order, sort_order), is_active = coalesce(p_is_active, is_active)
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_save_spot(
  p_id uuid, p_university_id uuid, p_campus_id uuid, p_name text, p_description text, p_sort_order int, p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_admin();
  if p_campus_id is not null and not exists (
    select 1 from public.campuses c where c.id = p_campus_id and c.university_id = p_university_id
  ) then
    raise exception 'invalid_campus';
  end if;
  if p_id is null then
    insert into public.meetup_spots (university_id, campus_id, name, description, sort_order, is_active)
    values (p_university_id, p_campus_id, btrim(p_name), private.clean_line(p_description),
            coalesce(p_sort_order, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update public.meetup_spots
    set campus_id = p_campus_id, name = btrim(p_name), description = private.clean_line(p_description),
        sort_order = coalesce(p_sort_order, sort_order), is_active = coalesce(p_is_active, is_active)
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_set_item_status(p_item_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.items%rowtype;
begin
  perform private.assert_admin();
  if p_status not in ('active', 'hidden', 'removed') then
    raise exception 'invalid_status';
  end if;
  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null then
    raise exception 'item_not_found';
  end if;
  if v_item.status = 'reserved' then
    raise exception 'item_in_trade';
  end if;
  update public.items set status = p_status, removed_reason = case when p_status = 'removed' then coalesce(p_reason, 'admin') end
  where id = p_item_id;
  if p_status = 'removed' then
    perform private.notify(v_item.seller_id, 'moderation', '出品が非公開になりました',
      '「' || v_item.title || '」は運営の判断により非公開になりました。' || coalesce('理由: ' || p_reason, ''),
      '/me', null, v_item.id);
  end if;
end;
$$;

create or replace function public.admin_cancel_trade(p_trade_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  perform private.cancel_trade_internal(p_trade_id, null, 'admin', private.clean_text(p_note));
end;
$$;

create or replace function public.admin_mark_handed_over(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if not exists (select 1 from public.trades where id = p_trade_id and status in ('negotiating', 'scheduled')) then
    raise exception 'trade_not_open';
  end if;
  perform private.mark_handed_over(p_trade_id, 'admin');
end;
$$;

create or replace function public.admin_restrict_user(p_user_id uuid, p_kind text, p_reason text, p_ends_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email text;
  v_trade record;
begin
  perform private.assert_admin();
  if p_kind not in ('suspended', 'banned') or private.clean_text(p_reason) is null then
    raise exception 'invalid_restriction';
  end if;

  insert into public.user_restrictions (user_id, kind, reason, ends_at, created_by)
  values (p_user_id, p_kind, private.clean_text(p_reason), case when p_kind = 'banned' then null else p_ends_at end, auth.uid())
  returning id into v_id;

  for v_trade in
    select t.id from public.trades t
    where p_user_id in (t.buyer_id, t.seller_id) and t.status in ('negotiating', 'scheduled')
  loop
    perform private.cancel_trade_internal(v_trade.id, null, 'admin', null);
  end loop;

  update public.items set status = 'hidden'
  where seller_id = p_user_id and status = 'active';

  if p_kind = 'banned' then
    select u.email into v_email from auth.users u where u.id = p_user_id;
    if v_email is not null then
      insert into public.banned_emails (email_hash, reason)
      values (private.email_hash(v_email), private.clean_text(p_reason))
      on conflict (email_hash) do nothing;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_lift_restriction(p_restriction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.user_restrictions%rowtype;
  v_email text;
begin
  perform private.assert_admin();
  update public.user_restrictions set lifted_at = now(), lifted_by = auth.uid()
  where id = p_restriction_id and lifted_at is null
  returning * into v_row;
  if v_row.kind = 'banned' then
    select u.email into v_email from auth.users u where u.id = v_row.user_id;
    if v_email is not null then
      delete from public.banned_emails where email_hash = private.email_hash(v_email);
    end if;
  end if;
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid_status';
  end if;
  update public.reports
  set status = p_status,
      admin_note = private.clean_text(p_note),
      resolved_at = case when p_status = 'open' then null else now() end,
      resolved_by = case when p_status = 'open' then null else auth.uid() end
  where id = p_report_id;
end;
$$;

create or replace function public.admin_reply_inquiry(p_inquiry_id uuid, p_reply text, p_status text default 'answered')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.inquiries%rowtype;
begin
  perform private.assert_admin();
  update public.inquiries
  set reply = private.clean_text(p_reply),
      replied_at = case when private.clean_text(p_reply) is null then replied_at else now() end,
      status = p_status
  where id = p_inquiry_id
  returning * into v_row;

  if v_row.user_id is not null and private.clean_text(p_reply) is not null then
    perform private.notify(v_row.user_id, 'inquiry_answered', 'お問い合わせに返信がありました',
      left(private.clean_text(p_reply), 120), '/settings/inquiries', null, null);
  end if;
end;
$$;

create or replace function public.admin_notify_user(p_user_id uuid, p_title text, p_body text, p_link text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  perform private.notify(p_user_id, 'announcement', btrim(p_title), private.clean_text(p_body), p_link, null, null);
end;
$$;

create or replace function public.admin_apply_university_name(p_university_id uuid, p_name text, p_short_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  update public.universities
  set name = btrim(p_name), short_name = private.clean_line(p_short_name), name_verified = true
  where id = p_university_id;
  delete from public.university_name_suggestions where university_id = p_university_id;
exception
  when unique_violation then
    if sqlerrm like '%universities_name_unique%' then
      raise exception 'university_name_taken';
    end if;
    raise;
end;
$$;

-- Member search with emails (admins only).
create or replace function public.admin_search_users(p_query text default null, p_university_id uuid default null, p_limit int default 50)
returns table (
  id uuid,
  email text,
  nickname text,
  university_id uuid,
  university_name text,
  faculty text,
  grade text,
  created_at timestamptz,
  deleted_at timestamptz,
  completed_trades int,
  rating_bad int,
  restricted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return query
  select p.id, u.email::text, p.nickname, p.university_id, un.name, p.faculty, p.grade, p.created_at, p.deleted_at,
         p.completed_trades, p.rating_bad,
         (private.active_restriction(p.id)).id is not null
  from public.profiles p
  left join auth.users u on u.id = p.id
  join public.universities un on un.id = p.university_id
  where (p_university_id is null or p.university_id = p_university_id)
    and (
      p_query is null or btrim(p_query) = ''
      or p.nickname ilike '%' || btrim(p_query) || '%'
      or u.email ilike '%' || btrim(p_query) || '%'
      or p.id::text = btrim(p_query)
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user_id),
    'email', (select u.email from auth.users u where u.id = p_user_id),
    'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = p_user_id),
    'university', (select jsonb_build_object('id', un.id, 'name', un.name) from public.profiles p
                   join public.universities un on un.id = p.university_id where p.id = p_user_id),
    'restrictions', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc)
                              from public.user_restrictions r where r.user_id = p_user_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'status', i.status,
                         'price', i.price, 'created_at', i.created_at) order by i.created_at desc)
                       from public.items i where i.seller_id = p_user_id), '[]'::jsonb),
    'trades', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'item_title', t.item_title, 'status', t.status,
                          'role', case when t.buyer_id = p_user_id then 'buyer' else 'seller' end,
                          'cancel_reason', t.cancel_reason, 'created_at', t.created_at) order by t.created_at desc)
                        from public.trades t where p_user_id in (t.buyer_id, t.seller_id)), '[]'::jsonb),
    'reports_against', (select count(*) from public.reports r where r.target_type = 'user' and r.target_id = p_user_id)
  );
end;
$$;

-- Landing page: universities that are live (verified names only).
create or replace function public.public_university_directory()
returns table (name text, short_name text, members int, active_items int)
language sql
stable
security definer
set search_path = ''
as $$
  select u.name, u.short_name,
    (select count(*)::int from public.profiles p where p.university_id = u.id and p.deleted_at is null),
    (select count(*)::int from public.items i where i.university_id = u.id and i.status = 'active')
  from public.universities u
  where u.status = 'active' and u.name_verified
    and exists (select 1 from public.profiles p where p.university_id = u.id and p.deleted_at is null)
  order by 3 desc, u.name
  limit 100;
$$;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.reports enable row level security;
alter table public.inquiries enable row level security;

create policy reports_read on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_platform_admin()));
create policy inquiries_read on public.inquiries for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

revoke all on public.reports, public.inquiries from anon, authenticated;
grant select on public.reports, public.inquiries to authenticated;
grant all on public.reports, public.inquiries to service_role;
