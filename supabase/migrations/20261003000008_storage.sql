-- =============================================================================
-- Storage buckets. Images are re-encoded to WebP/JPEG in the browser before
-- upload (which also strips EXIF/GPS), so buckets only accept small images.
--
--   item-images  public   <university_id>/<user_id>/<uuid>.webp
--   avatars      public   <user_id>/<uuid>.webp
--   chat-images  private  <trade_id>/<uuid>.webp   (participants only, signed URLs)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('item-images', 'item-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png']),
  ('chat-images', 'chat-images', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- item-images -----------------------------------------------------------------

create policy "item images: members upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select public.my_university_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 2
  );

create policy "item images: owners delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- avatars ---------------------------------------------------------------------

create policy "avatars: members upload their own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "avatars: owners delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- chat-images -----------------------------------------------------------------

create or replace function private.can_access_trade_files(p_folder text, p_for_write boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trades t
    where t.id::text = p_folder
      and auth.uid() in (t.buyer_id, t.seller_id)
      and (not p_for_write or t.status in ('negotiating', 'scheduled', 'handed_over'))
  )
  or (not p_for_write and public.is_platform_admin());
$$;

create policy "chat images: participants upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and array_length(storage.foldername(name), 1) = 1
    and private.can_access_trade_files((storage.foldername(name))[1], true)
  );

create policy "chat images: participants read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and private.can_access_trade_files((storage.foldername(name))[1], false)
  );
