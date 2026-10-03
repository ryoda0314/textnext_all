-- =============================================================================
-- Account deletion and the ISBN lookup cache.
-- =============================================================================

-- Book metadata fetched by /api/books/isbn. Written by the server only.
create table public.book_cache (
  isbn text primary key,
  title text not null,
  author text,
  publisher text,
  list_price int,
  source text not null,
  fetched_at timestamptz not null default now(),
  constraint book_cache_isbn_format check (isbn ~ '^97[89][0-9]{10}$')
);
alter table public.book_cache enable row level security;
revoke all on public.book_cache from anon, authenticated;
grant all on public.book_cache to service_role;

-- Step 1 of account deletion (the API route then removes files and the auth user).
-- Never-traded listings are deleted outright; everything else is anonymised.
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_paths jsonb;
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.avatar_path into v_avatar from public.profiles p where p.id = v_uid;

  select coalesce(jsonb_agg(s.path), '[]'::jsonb) into v_paths
  from (
    select img.value ->> 'path' as path
    from public.items i, jsonb_array_elements(i.images) img
    where i.seller_id = v_uid and not exists (select 1 from public.trades t where t.item_id = i.id)
    union all
    select img.value ->> 'thumb'
    from public.items i, jsonb_array_elements(i.images) img
    where i.seller_id = v_uid and img.value ? 'thumb'
      and not exists (select 1 from public.trades t where t.item_id = i.id)
  ) s;

  delete from public.items i
  where i.seller_id = v_uid and not exists (select 1 from public.trades t where t.item_id = i.id);

  perform private.anonymize_user(v_uid);

  return jsonb_build_object('item_paths', v_paths, 'avatar_path', v_avatar);
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
