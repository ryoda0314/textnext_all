-- =============================================================================
-- Universities (tenants), email-domain rules, and sign-up gating.
--
-- Every member belongs to exactly one university, derived from the verified
-- email address — never chosen by the user. Trading only happens inside it.
--
-- Domain resolution order for an email address:
--   1. signup_email_overrides  (exact address → university; for testing / special cases)
--   2. university_domains      (longest matching rule; optionally covers subdomains)
--   3. *.ac.jp fallback        (auto-creates a group keyed by the registrable domain,
--                               e.g. st.kyoto-u.ac.jp → kyoto-u.ac.jp)
-- Anything else is rejected. Admin addresses (admin_email_allowlist) may sign up
-- without a university; they manage the service but cannot trade.
-- =============================================================================

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  status text not null default 'active',
  external_url text,
  is_auto_created boolean not null default false,
  name_verified boolean not null default false,
  -- Selling price cap as a percentage of the list price (定価). TextNext's core rule: 30%.
  price_cap_percent int not null default 30,
  -- Time bands offered when proposing a hand-over. Night trades are forbidden by the terms.
  meetup_slots jsonb not null default '[
    {"id": "morning",   "label": "午前",   "hint": "9〜12時"},
    {"id": "lunch",     "label": "昼休み", "hint": "12〜13時"},
    {"id": "afternoon", "label": "午後",   "hint": "13〜17時"},
    {"id": "evening",   "label": "夕方",   "hint": "17〜19時"}
  ]'::jsonb,
  -- カーリル (calil.jp) system id of the university library, e.g. 'Univ_Titech'. Optional.
  calil_system_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint universities_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  constraint universities_name_length check (char_length(name) between 1 and 80),
  constraint universities_short_name_length check (short_name is null or char_length(short_name) between 1 and 20),
  constraint universities_status_values check (status in ('active', 'external', 'closed')),
  constraint universities_external_needs_url check (status <> 'external' or external_url is not null),
  constraint universities_price_cap_range check (price_cap_percent between 1 and 100),
  constraint universities_meetup_slots_array check (jsonb_typeof(meetup_slots) = 'array' and jsonb_array_length(meetup_slots) between 1 and 8)
);

create trigger universities_touch before update on public.universities
  for each row execute function private.touch_updated_at();

-- Two groups with the same name would split one campus into two markets that cannot
-- see each other. Another domain of the same university → add the domain or merge.
create unique index universities_name_unique on public.universities (private.normalize_text(name));

create table public.university_domains (
  domain text primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  include_subdomains boolean not null default true,
  created_at timestamptz not null default now(),
  constraint university_domains_format check (domain ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$')
);
create index university_domains_university_idx on public.university_domains(university_id);

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint campuses_name_length check (char_length(name) between 1 and 40),
  unique (university_id, name)
);

-- Hand-over spots. campus_id null = shown for every campus of the university.
create table public.meetup_spots (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete cascade,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint meetup_spots_name_length check (char_length(name) between 1 and 40),
  constraint meetup_spots_description_length check (description is null or char_length(description) <= 120)
);
create index meetup_spots_university_idx on public.meetup_spots(university_id, sort_order);

-- Exact address → university. Lets the operator test with e.g. a Gmail address.
create table public.signup_email_overrides (
  email text primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  constraint signup_email_overrides_lower check (email = lower(btrim(email)))
);

-- Addresses allowed to sign up as platform administrators (no university).
create table public.admin_email_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  constraint admin_email_allowlist_lower check (email = lower(btrim(email)))
);

-- Hashes of addresses that may not register again (set when banning).
create table public.banned_emails (
  email_hash text primary key,
  reason text,
  created_at timestamptz not null default now()
);

-- Display-name proposals for auto-created groups ("kyoto-u.ac.jp" → "京都大学").
-- Members suggest, an admin applies. Prevents trolling names going live.
create table public.university_name_suggestions (
  university_id uuid not null references public.universities(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (university_id, user_id),
  constraint university_name_suggestions_length check (char_length(name) between 2 and 40)
);

-- Requests from addresses we cannot place yet (e.g. a non-.ac.jp university domain).
create table public.university_requests (
  id uuid primary key default gen_random_uuid(),
  email_domain text not null,
  university_name text not null,
  contact_email text,
  created_at timestamptz not null default now(),
  constraint university_requests_name_length check (char_length(university_name) between 2 and 80)
);

-- -----------------------------------------------------------------------------
-- Admin check
-- -----------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_email_allowlist a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

create or replace function private.assert_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Domain resolution
-- -----------------------------------------------------------------------------

-- Matching only; never creates anything.
create or replace function private.match_university(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_domain text := private.email_domain(v_email);
  v_university_id uuid;
begin
  if v_domain is null then
    return null;
  end if;

  select o.university_id into v_university_id
  from public.signup_email_overrides o
  where o.email = v_email;
  if found then
    return v_university_id;
  end if;

  select d.university_id into v_university_id
  from public.university_domains d
  where v_domain = d.domain
     or (d.include_subdomains and right(v_domain, char_length(d.domain) + 1) = '.' || d.domain)
  order by char_length(d.domain) desc
  limit 1;

  return v_university_id;
end;
$$;

create or replace function private.unique_university_slug(p_base text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base text := left(regexp_replace(lower(coalesce(p_base, 'campus')), '[^a-z0-9-]+', '-', 'g'), 40);
  v_slug text;
  v_n int := 1;
begin
  v_base := btrim(v_base, '-');
  if v_base = '' or char_length(v_base) < 2 then
    v_base := 'campus';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.universities where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- Generic hand-over spots that exist on practically every campus. Admins can edit them.
create or replace function private.seed_default_spots(p_university_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.meetup_spots (university_id, name, description, sort_order)
  select p_university_id, s.name, s.description, s.sort_order
  from (values
    ('図書館前', '入口付近の人通りが多い場所', 10),
    ('生協・購買前', null, 20),
    ('学生食堂前', null, 30),
    ('正門前', null, 40)
  ) as s(name, description, sort_order)
  where not exists (select 1 from public.meetup_spots m where m.university_id = p_university_id);
$$;

-- Matching, plus auto-creation of a group for unknown *.ac.jp domains.
create or replace function private.resolve_or_create_university(p_email text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_university_id uuid := private.match_university(p_email);
  v_base text;
begin
  if v_university_id is not null then
    return v_university_id;
  end if;

  v_base := private.ac_jp_base_domain(private.email_domain(p_email));
  if v_base is null then
    return null;
  end if;

  insert into public.universities (slug, name, is_auto_created)
  values (private.unique_university_slug(split_part(v_base, '.', 1)), v_base, true)
  on conflict do nothing
  returning id into v_university_id;

  if v_university_id is not null then
    insert into public.university_domains (domain, university_id, include_subdomains)
    values (v_base, v_university_id, true)
    on conflict (domain) do nothing;

    if found then
      perform private.seed_default_spots(v_university_id);
      return v_university_id;
    end if;
    delete from public.universities where id = v_university_id;
  end if;

  -- Another sign-up created the group concurrently; use theirs.
  select d.university_id into v_university_id from public.university_domains d where d.domain = v_base;
  return v_university_id;
end;
$$;

-- Single source of truth for "may this address register?".
-- Returns {ok, kind: 'member'|'admin', university:{...}} or {ok:false, reason, message}.
create or replace function private.signup_email_verdict(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_domain text := private.email_domain(v_email);
  v_university public.universities%rowtype;
  v_university_id uuid;
  v_base text;
begin
  if v_domain is null or v_email !~ '^[^@[:space:]]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid',
      'message', 'メールアドレスの形式が正しくありません');
  end if;

  if exists (select 1 from public.admin_email_allowlist a where a.email = v_email) then
    return jsonb_build_object('ok', true, 'kind', 'admin');
  end if;

  if exists (select 1 from public.banned_emails b where b.email_hash = private.email_hash(v_email)) then
    return jsonb_build_object('ok', false, 'reason', 'blocked',
      'message', 'このメールアドレスでは登録できません。お心当たりがない場合はお問い合わせください。');
  end if;

  v_university_id := private.match_university(v_email);

  if v_university_id is not null then
    select * into v_university from public.universities where id = v_university_id;
    if v_university.status = 'external' then
      return jsonb_build_object('ok', false, 'reason', 'external',
        'university_name', v_university.name,
        'external_url', v_university.external_url,
        'message', v_university.name || 'の方は専用サービスをご利用ください（' || v_university.external_url || '）');
    elsif v_university.status = 'closed' then
      return jsonb_build_object('ok', false, 'reason', 'closed',
        'university_name', v_university.name,
        'message', v_university.name || 'は現在、新規登録を受け付けていません');
    end if;
    return jsonb_build_object('ok', true, 'kind', 'member',
      'university', jsonb_build_object(
        'id', v_university.id,
        'name', v_university.name,
        'name_verified', v_university.name_verified,
        'is_new', false));
  end if;

  v_base := private.ac_jp_base_domain(v_domain);
  if v_base is not null then
    return jsonb_build_object('ok', true, 'kind', 'member',
      'university', jsonb_build_object(
        'id', null,
        'name', v_base,
        'name_verified', false,
        'is_new', true));
  end if;

  return jsonb_build_object('ok', false, 'reason', 'unsupported',
    'domain', v_domain,
    'message', 'このドメイン（' || v_domain || '）はまだ対応していません。大学から発行されたメールアドレスを使ってください。');
end;
$$;

-- Public preview used by the sign-up form (domain-based only; reveals nothing about accounts).
create or replace function public.check_signup_email(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.signup_email_verdict(p_email);
$$;

-- Supabase Auth "Before User Created" hook: rejects with a readable message.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_verdict jsonb := private.signup_email_verdict(event -> 'user' ->> 'email');
begin
  if coalesce((v_verdict ->> 'ok')::boolean, false) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', coalesce(v_verdict ->> 'message', 'このメールアドレスでは登録できません')));
end;
$$;

-- Backstop: the same rule enforced inside the database, even if the hook is not configured.
create or replace function private.enforce_signup_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verdict jsonb;
begin
  if new.email is null then
    raise exception 'textnext: email is required to sign up';
  end if;
  v_verdict := private.signup_email_verdict(new.email);
  if not coalesce((v_verdict ->> 'ok')::boolean, false) then
    raise exception 'textnext: sign-up rejected (%)', v_verdict ->> 'reason';
  end if;
  return new;
end;
$$;

create trigger textnext_enforce_signup_email
  before insert on auth.users
  for each row execute function private.enforce_signup_email();

create or replace function public.request_university(p_email text, p_university_name text, p_contact_email text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text := private.email_domain(p_email);
  v_name text := private.clean_line(p_university_name);
begin
  if v_domain is null or v_name is null then
    raise exception 'invalid_request';
  end if;
  -- Light throttle: at most 20 requests per domain per day.
  if (select count(*) from public.university_requests r
      where r.email_domain = v_domain and r.created_at > now() - interval '1 day') >= 20 then
    return;
  end if;
  insert into public.university_requests (email_domain, university_name, contact_email)
  values (v_domain, left(v_name, 80), nullif(lower(btrim(coalesce(p_contact_email, ''))), ''));
end;
$$;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.universities enable row level security;
alter table public.university_domains enable row level security;
alter table public.campuses enable row level security;
alter table public.meetup_spots enable row level security;
alter table public.signup_email_overrides enable row level security;
alter table public.admin_email_allowlist enable row level security;
alter table public.banned_emails enable row level security;
alter table public.university_name_suggestions enable row level security;
alter table public.university_requests enable row level security;

-- University names, campuses and spots are public information.
create policy universities_read on public.universities for select to anon, authenticated using (true);
create policy campuses_read on public.campuses for select to anon, authenticated using (true);
create policy meetup_spots_read on public.meetup_spots for select to anon, authenticated using (true);

-- Domain rules and the rest are visible to admins only (writes go through admin RPCs).
create policy university_domains_admin on public.university_domains for select to authenticated
  using ((select public.is_platform_admin()));
create policy signup_email_overrides_admin on public.signup_email_overrides for select to authenticated
  using ((select public.is_platform_admin()));
create policy name_suggestions_admin on public.university_name_suggestions for select to authenticated
  using ((select public.is_platform_admin()) or user_id = (select auth.uid()));
create policy university_requests_admin on public.university_requests for select to authenticated
  using ((select public.is_platform_admin()));

-- -----------------------------------------------------------------------------
-- Grants (explicit, so behaviour does not depend on project defaults)
-- -----------------------------------------------------------------------------

revoke all on public.universities, public.university_domains, public.campuses, public.meetup_spots,
  public.signup_email_overrides, public.admin_email_allowlist, public.banned_emails,
  public.university_name_suggestions, public.university_requests from anon, authenticated;

grant select on public.universities, public.campuses, public.meetup_spots to anon, authenticated;
grant select on public.university_domains, public.signup_email_overrides,
  public.university_name_suggestions, public.university_requests to authenticated;

grant all on public.universities, public.university_domains, public.campuses, public.meetup_spots,
  public.signup_email_overrides, public.admin_email_allowlist, public.banned_emails,
  public.university_name_suggestions, public.university_requests to service_role;

revoke execute on function public.check_signup_email(text) from public;
grant execute on function public.check_signup_email(text) to anon, authenticated;

revoke execute on function public.request_university(text, text, text) from public;
grant execute on function public.request_university(text, text, text) to anon, authenticated;

revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, service_role;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
