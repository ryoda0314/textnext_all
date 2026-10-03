-- =============================================================================
-- Listings, favourites and wish alerts (入荷通知).
-- =============================================================================

create table public.items (
  id uuid primary key default gen_random_uuid(),
  -- Defaults document what the insert trigger enforces for client writes.
  university_id uuid not null default public.my_university_id() references public.universities(id),
  seller_id uuid not null default auth.uid() references public.profiles(id),
  campus_id uuid references public.campuses(id) on delete set null,
  title text not null,
  author text,
  publisher text,
  isbn text,
  course_name text,
  description text,
  condition text not null,
  writing text not null default 'none',
  list_price int not null,
  price int not null,
  -- [{ "path": "<university>/<seller>/<uuid>.webp", "thumb": "...", "w": 1200, "h": 1600 }, ...]
  images jsonb not null default '[]'::jsonb,
  -- active: on sale / reserved: in a trade / sold / hidden: unlisted by the seller / removed
  status text not null default 'active',
  removed_reason text,
  search_text text not null default '',
  favorite_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  constraint items_title_length check (char_length(title) between 1 and 100),
  constraint items_author_length check (author is null or char_length(author) <= 100),
  constraint items_publisher_length check (publisher is null or char_length(publisher) <= 60),
  constraint items_isbn_format check (isbn is null or isbn ~ '^97[89][0-9]{10}$'),
  constraint items_course_length check (course_name is null or char_length(course_name) <= 60),
  constraint items_description_length check (description is null or char_length(description) <= 500),
  constraint items_condition_values check (condition in ('like_new', 'good', 'fair', 'poor')),
  constraint items_writing_values check (writing in ('none', 'some', 'lots')),
  constraint items_list_price_range check (list_price between 1 and 50000),
  constraint items_price_range check (price between 0 and 50000),
  constraint items_status_values check (status in ('active', 'reserved', 'sold', 'hidden', 'removed')),
  constraint items_images_array check (jsonb_typeof(images) = 'array')
);

create index items_feed_idx on public.items (university_id, status, created_at desc);
create index items_seller_idx on public.items (seller_id, created_at desc);
create index items_isbn_idx on public.items (university_id, isbn) where isbn is not null;
create index items_search_trgm_idx on public.items using gin (search_text extensions.gin_trgm_ops);

create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index favorites_item_idx on public.favorites (item_id);

-- 入荷通知: notify me when a matching book is listed at my university.
create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  university_id uuid not null default public.my_university_id() references public.universities(id),
  isbn text,
  keyword text,
  keyword_norm text,
  label text not null,
  created_at timestamptz not null default now(),
  last_notified_at timestamptz,
  constraint wishes_one_target check ((isbn is null) <> (keyword is null)),
  constraint wishes_isbn_format check (isbn is null or isbn ~ '^97[89][0-9]{10}$'),
  constraint wishes_keyword_length check (keyword is null or char_length(keyword) between 2 and 40),
  constraint wishes_label_length check (char_length(label) between 1 and 100)
);
create unique index wishes_user_isbn_unique on public.wishes (user_id, isbn) where isbn is not null;
create unique index wishes_user_keyword_unique on public.wishes (user_id, keyword_norm) where keyword_norm is not null;
create index wishes_university_isbn_idx on public.wishes (university_id, isbn) where isbn is not null;
create index wishes_university_keyword_idx on public.wishes (university_id) where keyword_norm is not null;

-- -----------------------------------------------------------------------------
-- Pricing
-- -----------------------------------------------------------------------------

-- Highest allowed selling price: list price × cap %, rounded down to 10 yen (cash friendly).
-- Integer maths on purpose; the client computes the same thing.
create or replace function private.price_cap(p_list_price int, p_percent int)
returns int
language sql
immutable
set search_path = ''
as $$
  select ((p_list_price * p_percent) / 1000) * 10;
$$;

-- -----------------------------------------------------------------------------
-- Item validation. SECURITY INVOKER on purpose: current_user tells apart direct
-- client writes ('authenticated') from trusted RPCs running as the owner.
-- -----------------------------------------------------------------------------

create or replace function private.items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_percent int;
  v_prefix text;
  v_image jsonb;
  v_is_client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if v_is_client then
      new.seller_id := auth.uid();
      new.university_id := public.my_university_id();
      new.status := 'active';
      new.removed_reason := null;
      new.favorite_count := 0;
      new.created_at := now();
      new.sold_at := null;

      if new.university_id is null or not private.is_active_user(new.seller_id) then
        raise exception 'account_restricted' using errcode = '42501';
      end if;
      if (select count(*) from public.items i
          where i.seller_id = new.seller_id and i.created_at > now() - interval '1 day') >= 30 then
        raise exception 'listing_rate_limited';
      end if;
      if new.campus_id is null then
        select p.campus_id into new.campus_id from public.profiles p where p.id = new.seller_id;
      end if;
    end if;
  else
    if v_is_client then
      if old.status not in ('active', 'hidden') then
        raise exception 'item_locked';
      end if;
      if new.status not in ('active', 'hidden') then
        raise exception 'invalid_status';
      end if;
      if not private.is_active_user(old.seller_id) then
        raise exception 'account_restricted' using errcode = '42501';
      end if;
    end if;
  end if;

  new.title := private.clean_line(new.title);
  new.author := private.clean_line(new.author);
  new.publisher := private.clean_line(new.publisher);
  new.course_name := private.clean_line(new.course_name);
  new.description := private.clean_text(new.description);
  new.isbn := nullif(regexp_replace(coalesce(new.isbn, ''), '[^0-9]', '', 'g'), '');

  if new.title is null then
    raise exception 'title_required';
  end if;

  if new.campus_id is not null and not exists (
    select 1 from public.campuses c where c.id = new.campus_id and c.university_id = new.university_id
  ) then
    raise exception 'invalid_campus';
  end if;

  select u.price_cap_percent into v_percent from public.universities u where u.id = new.university_id;
  if new.price > private.price_cap(new.list_price, v_percent) then
    raise exception 'price_above_cap';
  end if;

  if jsonb_typeof(new.images) <> 'array'
     or jsonb_array_length(new.images) < 1
     or jsonb_array_length(new.images) > 4 then
    raise exception 'invalid_images';
  end if;
  v_prefix := new.university_id::text || '/' || new.seller_id::text || '/';
  for v_image in select value from jsonb_array_elements(new.images) loop
    if jsonb_typeof(v_image) <> 'object'
       or coalesce(v_image ->> 'path', '') = ''
       or left(v_image ->> 'path', char_length(v_prefix)) <> v_prefix
       or (v_image ? 'thumb' and left(v_image ->> 'thumb', char_length(v_prefix)) <> v_prefix)
       or (v_image ->> 'path') ~ '\.\.' then
      raise exception 'invalid_image_path';
    end if;
  end loop;

  new.search_text := private.normalize_text(concat_ws(' ',
    new.title, new.author, new.publisher, new.course_name, new.isbn));
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_validate before insert or update on public.items
  for each row execute function private.items_before_write();

-- Notify members whose wish matches a new listing.
create or replace function private.items_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return null;
  end if;

  with matched as (
    select distinct on (w.user_id) w.id, w.user_id
    from public.wishes w
    where w.university_id = new.university_id
      and w.user_id <> new.seller_id
      and (
        (w.isbn is not null and w.isbn = new.isbn)
        or (w.keyword_norm is not null and strpos(new.search_text, w.keyword_norm) > 0)
      )
    order by w.user_id, (w.isbn is not null) desc
  ),
  touched as (
    update public.wishes w set last_notified_at = now()
    from matched m where w.id = m.id
    returning w.user_id
  )
  insert into public.notifications (user_id, type, title, body, link, item_id)
  select t.user_id,
         'wish_match',
         '探している本が出品されました',
         '「' || new.title || '」が' || to_char(new.price, 'FM999,999') || '円で出品されました',
         '/items/' || new.id,
         new.id
  from touched t;

  return null;
end;
$$;

create trigger items_notify_wishes after insert on public.items
  for each row execute function private.items_after_insert();

-- Keep favorite_count in sync.
create or replace function private.favorites_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.items set favorite_count = favorite_count + 1 where id = new.item_id;
  else
    update public.items set favorite_count = greatest(favorite_count - 1, 0) where id = old.item_id;
  end if;
  return null;
end;
$$;

create trigger favorites_count after insert or delete on public.favorites
  for each row execute function private.favorites_count();

create or replace function private.wishes_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.university_id := public.my_university_id();
  if new.university_id is null then
    raise exception 'account_restricted' using errcode = '42501';
  end if;
  new.isbn := nullif(regexp_replace(coalesce(new.isbn, ''), '[^0-9]', '', 'g'), '');
  new.keyword := private.clean_line(new.keyword);
  new.keyword_norm := case when new.keyword is null then null else private.normalize_text(new.keyword) end;
  new.label := coalesce(private.clean_line(new.label), new.keyword, new.isbn);
  if (select count(*) from public.wishes w where w.user_id = new.user_id) >= 30 then
    raise exception 'wish_limit_reached';
  end if;
  return new;
end;
$$;

create trigger wishes_validate before insert on public.wishes
  for each row execute function private.wishes_before_insert();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Deletes a listing. Never-traded items are removed for good (the caller then
-- deletes the returned storage paths); otherwise the listing is retired.
create or replace function public.delete_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.items%rowtype;
  v_paths jsonb;
begin
  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null or v_item.seller_id is distinct from v_uid then
    raise exception 'item_not_found';
  end if;
  if v_item.status = 'reserved' then
    raise exception 'item_in_trade';
  end if;

  if exists (select 1 from public.trades t where t.item_id = p_item_id) then
    update public.items set status = 'removed', removed_reason = 'seller' where id = p_item_id;
    return jsonb_build_object('deleted', false, 'paths', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(p), '[]'::jsonb) into v_paths
  from (
    select value ->> 'path' as p from jsonb_array_elements(v_item.images)
    union all
    select value ->> 'thumb' from jsonb_array_elements(v_item.images) where value ? 'thumb'
  ) s;

  delete from public.items where id = p_item_id;
  return jsonb_build_object('deleted', true, 'paths', v_paths);
end;
$$;

-- Number of other members at my university waiting for this ISBN.
create or replace function public.wish_demand(p_isbn text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.wishes w
  where w.university_id = public.my_university_id()
    and w.isbn = regexp_replace(coalesce(p_isbn, ''), '[^0-9]', '', 'g')
    and w.user_id <> auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Market view & search
-- -----------------------------------------------------------------------------

-- What other members may browse: live listings from non-paused sellers.
create or replace view public.market_items
with (security_invoker = true) as
select
  i.id,
  i.university_id,
  i.seller_id,
  i.campus_id,
  c.name as campus_name,
  i.title,
  i.author,
  i.publisher,
  i.isbn,
  i.course_name,
  i.condition,
  i.writing,
  i.list_price,
  i.price,
  i.images,
  i.status,
  i.favorite_count,
  i.created_at,
  i.search_text,
  p.nickname as seller_nickname,
  p.avatar_path as seller_avatar_path,
  p.faculty as seller_faculty,
  p.department as seller_department,
  p.rating_good as seller_rating_good,
  p.rating_bad as seller_rating_bad
from public.items i
join public.profiles p on p.id = i.seller_id
left join public.campuses c on c.id = i.campus_id
where i.status in ('active', 'reserved')
  and p.deleted_at is null
  and not p.listings_paused;

-- Multi-keyword search. Whitespace-separated terms are AND-ed; a 10/13-digit
-- query is treated as an ISBN.
create or replace function public.search_items(
  p_query text default null,
  p_campus_id uuid default null,
  p_faculty text default null,
  p_free_only boolean default false,
  p_include_reserved boolean default true,
  p_sort text default 'new',
  p_limit int default 30,
  p_offset int default 0
)
returns setof public.market_items
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_query text := private.normalize_text(p_query);
  v_terms text[];
  v_isbn text;
begin
  v_isbn := regexp_replace(coalesce(p_query, ''), '[^0-9Xx]', '', 'g');
  if char_length(v_isbn) = 10 then
    v_isbn := private.isbn10_to_13(v_isbn);
  end if;
  if v_isbn is null or v_isbn !~ '^97[89][0-9]{10}$' or v_query ~ '[^0-9 xX-]' then
    v_isbn := null;
  end if;

  v_terms := case when v_query = '' then array[]::text[] else string_to_array(v_query, ' ') end;

  return query
  select m.*
  from public.market_items m
  where m.university_id = public.my_university_id()
    and (p_include_reserved or m.status = 'active')
    and (p_campus_id is null or m.campus_id = p_campus_id)
    and (p_faculty is null or m.seller_faculty = p_faculty)
    and (not p_free_only or m.price = 0)
    and (
      (v_isbn is not null and m.isbn = v_isbn)
      or (v_isbn is null and not exists (
        select 1 from unnest(v_terms) t(term)
        where strpos(m.search_text, t.term) = 0
      ))
    )
  order by
    (m.status = 'active') desc,
    case when p_sort = 'price_asc' then m.price end asc nulls last,
    case when p_sort = 'price_desc' then m.price end desc nulls last,
    case when p_sort = 'popular' then m.favorite_count end desc nulls last,
    m.created_at desc
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
end;
$$;

create or replace function private.isbn10_to_13(p_isbn10 text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_core text;
  v_sum int := 0;
  v_i int;
begin
  if p_isbn10 is null or p_isbn10 !~ '^[0-9]{9}[0-9Xx]$' then
    return null;
  end if;
  v_core := '978' || left(p_isbn10, 9);
  for v_i in 1..12 loop
    v_sum := v_sum + substr(v_core, v_i, 1)::int * case when v_i % 2 = 1 then 1 else 3 end;
  end loop;
  return v_core || ((10 - v_sum % 10) % 10)::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.items enable row level security;
alter table public.favorites enable row level security;
alter table public.wishes enable row level security;

create policy items_read on public.items for select to authenticated
  using (
    (university_id = (select public.my_university_id()) and status in ('active', 'reserved', 'sold'))
    or seller_id = (select auth.uid())
    or (select public.is_platform_admin())
  );

create policy items_insert on public.items for insert to authenticated
  with check (seller_id = (select auth.uid()));

create policy items_update_own on public.items for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy favorites_own_read on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy favorites_own_insert on public.favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.items i
      where i.id = item_id
        and i.university_id = (select public.my_university_id())
        and i.seller_id <> (select auth.uid())
    )
  );
create policy favorites_own_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy wishes_own_read on public.wishes for select to authenticated
  using (user_id = (select auth.uid()));
create policy wishes_own_insert on public.wishes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy wishes_own_delete on public.wishes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.items, public.favorites, public.wishes from anon, authenticated;
revoke all on public.market_items from anon, authenticated;
grant select on public.items, public.market_items to authenticated;
grant insert (title, author, publisher, isbn, course_name, description, condition, writing,
  list_price, price, images, campus_id) on public.items to authenticated;
grant update (title, author, publisher, isbn, course_name, description, condition, writing,
  list_price, price, images, campus_id, status) on public.items to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, delete on public.wishes to authenticated;
grant insert (isbn, keyword, label) on public.wishes to authenticated;
grant all on public.items, public.favorites, public.wishes, public.market_items to service_role;

revoke execute on function public.delete_item(uuid), public.wish_demand(text),
  public.search_items(text, uuid, text, boolean, boolean, text, int, int) from public;
grant execute on function public.delete_item(uuid), public.wish_demand(text),
  public.search_items(text, uuid, text, boolean, boolean, text, int, int) to authenticated;
