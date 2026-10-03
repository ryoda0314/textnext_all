-- =============================================================================
-- Profiles, settings, restrictions, and membership helpers.
--
-- profiles.id equals auth.users.id but deliberately has no foreign key: when an
-- account is deleted the profile row stays behind, anonymised, so the other
-- party's trade history and ratings remain intact.
-- =============================================================================

create table public.profiles (
  id uuid primary key,
  university_id uuid not null references public.universities(id),
  nickname text not null,
  avatar_path text,
  faculty text,
  department text,
  grade text,
  campus_id uuid references public.campuses(id) on delete set null,
  bio text,
  -- おやすみモード: hides all of this member's listings from others.
  listings_paused boolean not null default false,
  -- Public reputation, updated only when a trade is finalised.
  rating_good int not null default 0,
  rating_normal int not null default 0,
  rating_bad int not null default 0,
  completed_trades int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_grade_values check (grade is null or grade in
    ('B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'M1', 'M2', 'D1', 'D2', 'D3', 'staff', 'other')),
  constraint profiles_nickname_length check (char_length(nickname) between 1 and 20),
  constraint profiles_faculty_length check (faculty is null or char_length(faculty) <= 40),
  constraint profiles_department_length check (department is null or char_length(department) <= 40),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 160)
);

create unique index profiles_nickname_unique
  on public.profiles (university_id, lower(nickname))
  where deleted_at is null;
create index profiles_university_idx on public.profiles (university_id);
create index profiles_faculty_idx on public.profiles (university_id, faculty);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_notifications boolean not null default true,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid,
  constraint user_restrictions_kind check (kind in ('suspended', 'banned')),
  constraint user_restrictions_period check (ends_at is null or ends_at > starts_at)
);
create index user_restrictions_user_idx on public.user_restrictions (user_id) where lifted_at is null;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Membership helpers (used by RLS policies — keep them cheap)
-- -----------------------------------------------------------------------------

create or replace function public.my_university_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.university_id
  from public.profiles p
  where p.id = auth.uid()
    and p.deleted_at is null;
$$;

create or replace function private.active_restriction(p_user_id uuid)
returns public.user_restrictions
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.user_restrictions r
  where r.user_id = p_user_id
    and r.lifted_at is null
    and r.starts_at <= now()
    and (r.ends_at is null or r.ends_at > now())
  order by (r.kind = 'banned') desc, r.ends_at desc nulls first
  limit 1;
$$;

-- Has a live profile, is not restricted, and their university is open.
create or replace function private.is_active_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.universities u on u.id = p.university_id
    where p.id = p_user_id
      and p.deleted_at is null
      and u.status = 'active'
  )
  and (private.active_restriction(p_user_id)).id is null;
$$;

create or replace function private.assert_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_active_user(v_uid) then
    raise exception 'account_restricted' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Validation
-- -----------------------------------------------------------------------------

create or replace function private.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nickname := private.clean_line(new.nickname);
  new.faculty := private.clean_line(new.faculty);
  new.department := private.clean_line(new.department);
  new.bio := private.clean_text(new.bio);

  if new.deleted_at is null then
    if new.nickname is null or char_length(new.nickname) < 2 or char_length(new.nickname) > 20 then
      raise exception 'nickname_length';
    end if;
    if new.nickname ~ '[@<>]' or private.normalize_text(new.nickname) ~ '^(textnext|運営|管理者|admin|事務局)' then
      raise exception 'nickname_not_allowed';
    end if;
    if new.faculty is null then
      raise exception 'faculty_required';
    end if;
  end if;

  if new.campus_id is not null and not exists (
    select 1 from public.campuses c where c.id = new.campus_id and c.university_id = new.university_id
  ) then
    raise exception 'invalid_campus';
  end if;

  if new.avatar_path is not null and left(new.avatar_path, 37) <> new.id::text || '/' then
    raise exception 'invalid_avatar_path';
  end if;

  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

-- -----------------------------------------------------------------------------
-- Onboarding
-- -----------------------------------------------------------------------------

-- Everything the app shell needs after login, in one round trip.
create or replace function public.get_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.profiles%rowtype;
  v_university public.universities%rowtype;
  v_restriction public.user_restrictions%rowtype;
  v_university_id uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  select * into v_profile from public.profiles p where p.id = v_uid;
  v_restriction := private.active_restriction(v_uid);

  v_university_id := coalesce(v_profile.university_id, private.match_university(v_email));
  if v_university_id is not null then
    select * into v_university from public.universities where id = v_university_id;
  end if;

  return jsonb_build_object(
    'user_id', v_uid,
    'email', v_email,
    'is_admin', public.is_platform_admin(),
    'profile', case when v_profile.id is null then null else to_jsonb(v_profile) end,
    'settings', (select to_jsonb(s) from public.user_settings s where s.user_id = v_uid),
    'restriction', case when v_restriction.id is null then null else jsonb_build_object(
      'kind', v_restriction.kind, 'reason', v_restriction.reason, 'ends_at', v_restriction.ends_at) end,
    'signup', case when v_profile.id is null then private.signup_email_verdict(v_email) else null end,
    'university', case when v_university.id is null then null else jsonb_build_object(
      'id', v_university.id,
      'slug', v_university.slug,
      'name', v_university.name,
      'short_name', v_university.short_name,
      'status', v_university.status,
      'name_verified', v_university.name_verified,
      'price_cap_percent', v_university.price_cap_percent,
      'meetup_slots', v_university.meetup_slots,
      'has_library', v_university.calil_system_id is not null,
      'campuses', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name)
        from public.campuses c
        where c.university_id = v_university.id and c.is_active), '[]'::jsonb),
      'spots', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description, 'campus_id', m.campus_id)
          order by m.sort_order, m.name)
        from public.meetup_spots m
        where m.university_id = v_university.id and m.is_active), '[]'::jsonb)
    ) end
  );
end;
$$;

-- Faculty / department names already used at my university (autocomplete).
create or replace function public.affiliation_suggestions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select coalesce(public.my_university_id(),
      private.match_university((select u.email from auth.users u where u.id = auth.uid()))) as university_id
  )
  select jsonb_build_object(
    'faculties', coalesce((
      select jsonb_agg(f.faculty order by f.n desc, f.faculty)
      from (
        select p.faculty, count(*) as n
        from public.profiles p, target t
        where p.university_id = t.university_id and p.deleted_at is null and p.faculty is not null
        group by p.faculty
        order by count(*) desc
        limit 40
      ) f), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('faculty', d.faculty, 'department', d.department) order by d.n desc)
      from (
        select p.faculty, p.department, count(*) as n
        from public.profiles p, target t
        where p.university_id = t.university_id and p.deleted_at is null and p.department is not null
        group by p.faculty, p.department
        order by count(*) desc
        limit 120
      ) d), '[]'::jsonb)
  );
$$;

create or replace function public.is_nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.university_id = coalesce(public.my_university_id(),
            private.match_university((select u.email from auth.users u where u.id = auth.uid())))
      and lower(p.nickname) = lower(private.clean_line(p_nickname))
      and p.deleted_at is null
      and p.id <> auth.uid()
  );
$$;

create or replace function public.complete_profile(
  p_nickname text,
  p_faculty text,
  p_department text,
  p_grade text,
  p_campus_id uuid,
  p_terms_version text,
  p_university_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_verdict jsonb;
  v_university_id uuid;
  v_profile public.profiles%rowtype;
  v_suggested text := private.clean_line(p_university_name);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'email_not_confirmed';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_exists';
  end if;

  if p_terms_version is null or btrim(p_terms_version) = '' then
    raise exception 'terms_not_accepted';
  end if;

  -- Admin addresses may also join a university when the address belongs to one.
  v_verdict := private.signup_email_verdict(v_email);
  if not coalesce((v_verdict ->> 'ok')::boolean, false) then
    raise exception 'university_unavailable';
  end if;

  v_university_id := private.resolve_or_create_university(v_email);
  if v_university_id is null or not exists (
    select 1 from public.universities u where u.id = v_university_id and u.status = 'active'
  ) then
    raise exception 'university_unavailable';
  end if;

  if p_campus_id is not null and not exists (
    select 1 from public.campuses c
    where c.id = p_campus_id and c.university_id = v_university_id and c.is_active
  ) then
    raise exception 'invalid_campus';
  end if;

  insert into public.profiles (id, university_id, nickname, faculty, department, grade, campus_id)
  values (v_uid, v_university_id, p_nickname, p_faculty, p_department, p_grade, p_campus_id)
  returning * into v_profile;

  insert into public.user_settings (user_id, terms_version, terms_accepted_at)
  values (v_uid, btrim(p_terms_version), now());

  if v_suggested is not null and char_length(v_suggested) between 2 and 40 and exists (
    select 1 from public.universities u where u.id = v_university_id and not u.name_verified
  ) then
    insert into public.university_name_suggestions (university_id, user_id, name)
    values (v_university_id, v_uid, v_suggested)
    on conflict (university_id, user_id) do update set name = excluded.name, created_at = now();
  end if;

  return v_profile;
exception
  when unique_violation then
    if sqlerrm like '%profiles_nickname_unique%' then
      raise exception 'nickname_taken';
    end if;
    raise;
end;
$$;

create or replace function public.accept_terms(p_terms_version text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_settings
  set terms_version = btrim(p_terms_version), terms_accepted_at = now()
  where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- auth.users lifecycle
-- -----------------------------------------------------------------------------

-- Email changes may not move a member to another university.
create or replace function private.guard_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid;
begin
  if new.email is distinct from old.email then
    select p.university_id into v_current
    from public.profiles p
    where p.id = new.id and p.deleted_at is null;

    if v_current is not null and private.match_university(new.email) is distinct from v_current then
      raise exception 'textnext: email change to another university is not allowed';
    end if;
  end if;
  return new;
end;
$$;

create trigger textnext_guard_email_change
  before update of email on auth.users
  for each row execute function private.guard_email_change();

-- Removes personal data while keeping the counterpart's history consistent.
-- Called on account deletion and whenever an auth user disappears.
create or replace function private.anonymize_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade record;
begin
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.deleted_at is null) then
    return;
  end if;

  for v_trade in
    select t.id from public.trades t
    where p_user_id in (t.buyer_id, t.seller_id)
      and t.status in ('negotiating', 'scheduled')
  loop
    perform private.cancel_trade_internal(v_trade.id, p_user_id, 'account_deleted', null);
  end loop;

  update public.items
  set status = 'removed', removed_reason = 'account_deleted'
  where seller_id = p_user_id and status in ('active', 'hidden', 'reserved');

  delete from public.favorites where user_id = p_user_id;
  delete from public.wishes where user_id = p_user_id;
  delete from public.push_subscriptions where user_id = p_user_id;
  delete from public.user_settings where user_id = p_user_id;

  update public.profiles
  set deleted_at = now(),
      nickname = '退会したユーザー',
      avatar_path = null,
      faculty = null,
      department = null,
      bio = null,
      campus_id = null,
      listings_paused = true
  where id = p_user_id;
end;
$$;

create or replace function private.handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.anonymize_user(old.id);
  return old;
end;
$$;

create trigger textnext_auth_user_deleted
  after delete on auth.users
  for each row execute function private.handle_auth_user_deleted();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_restrictions enable row level security;

-- Members only ever see people from their own university.
create policy profiles_read on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or university_id = (select public.my_university_id())
    or (select public.is_platform_admin())
  );

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

create policy user_settings_self_read on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_self_update on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_restrictions_read on public.user_restrictions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

revoke all on public.profiles, public.user_settings, public.user_restrictions from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, avatar_path, faculty, department, grade, campus_id, bio, listings_paused)
  on public.profiles to authenticated;
grant select on public.user_settings to authenticated;
grant update (email_notifications) on public.user_settings to authenticated;
grant select on public.user_restrictions to authenticated;
grant all on public.profiles, public.user_settings, public.user_restrictions to service_role;

revoke execute on function public.my_university_id(), public.get_my_context(),
  public.affiliation_suggestions(), public.is_nickname_available(text),
  public.complete_profile(text, text, text, text, uuid, text, text), public.accept_terms(text) from public;
grant execute on function public.my_university_id(), public.get_my_context(),
  public.affiliation_suggestions(), public.is_nickname_available(text),
  public.complete_profile(text, text, text, text, uuid, text, text), public.accept_terms(text) to authenticated;
grant execute on function public.my_university_id() to service_role;
