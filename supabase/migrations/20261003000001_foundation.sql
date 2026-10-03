-- =============================================================================
-- TextNext (multi-university) : foundation
-- Extensions, the private schema, and small helpers shared by later migrations.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Objects in `private` are never exposed through the Data API (not in api.schemas).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

-- Server-side settings (e.g. push dispatch URL/secret). Not reachable from clients.
create table private.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.settings from public;

-- -----------------------------------------------------------------------------
-- Text helpers
-- -----------------------------------------------------------------------------

-- NFKC + lower-case + collapsed whitespace. Used for search and duplicate checks.
-- The client mirrors this with: s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
create or replace function private.normalize_text(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(normalize(coalesce(p, ''), nfkc)), '\s+', ' ', 'g'));
$$;

-- Control characters stripped (newlines and tabs kept), trimmed, null when empty.
create or replace function private.clean_text(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g')), '');
$$;

-- Single-line variant: also folds newlines/tabs into spaces.
create or replace function private.clean_line(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select private.clean_text(regexp_replace(coalesce(p, ''), '[\r\n\t]+', ' ', 'g'));
$$;

create or replace function private.today_jst()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Email helpers
-- -----------------------------------------------------------------------------

create or replace function private.email_domain(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(lower(btrim(coalesce(p_email, ''))), '@', 2), '');
$$;

-- For *.ac.jp addresses, the registrable domain that identifies the institution:
--   'g.ecc.u-tokyo.ac.jp' -> 'u-tokyo.ac.jp',  'st.kyoto-u.ac.jp' -> 'kyoto-u.ac.jp'
-- Returns null for anything else.
create or replace function private.ac_jp_base_domain(p_domain text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_labels text[];
  v_count int;
begin
  if p_domain is null or p_domain !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+ac\.jp$' then
    return null;
  end if;
  v_labels := string_to_array(p_domain, '.');
  v_count := array_length(v_labels, 1);
  if v_count < 3 then
    return null;
  end if;
  return array_to_string(v_labels[v_count - 2:v_count], '.');
end;
$$;

-- Hash used to remember banned addresses without storing them in plain text.
create or replace function private.email_hash(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(p_email, ''))), 'UTF8')), 'hex');
$$;
