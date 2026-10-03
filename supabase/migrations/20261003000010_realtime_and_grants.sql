-- =============================================================================
-- Realtime publication and a final pass over function privileges.
-- =============================================================================

alter publication supabase_realtime add table public.messages, public.trades, public.notifications;

-- Public schema: nothing is callable by anonymous visitors unless listed here.
revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.check_signup_email(text),
  public.request_university(text, text, text),
  public.submit_inquiry(text, text, text),
  public.public_university_directory()
to anon;

-- Signed-in members: member RPCs + admin RPCs (which check is_platform_admin themselves).
grant execute on function
  public.submit_report(text, uuid, text, text),
  public.submit_inquiry(text, text, text),
  public.public_university_directory(),
  public.admin_dashboard(),
  public.admin_university_detail(uuid),
  public.admin_save_university(uuid, text, text, text, text, text, int, jsonb, text, boolean),
  public.admin_set_domain(text, uuid, boolean),
  public.admin_remove_domain(text),
  public.admin_merge_universities(uuid, uuid),
  public.admin_save_campus(uuid, uuid, text, int, boolean),
  public.admin_save_spot(uuid, uuid, uuid, text, text, int, boolean),
  public.admin_set_item_status(uuid, text, text),
  public.admin_cancel_trade(uuid, text),
  public.admin_mark_handed_over(uuid),
  public.admin_restrict_user(uuid, text, text, timestamptz),
  public.admin_lift_restriction(uuid),
  public.admin_resolve_report(uuid, text, text),
  public.admin_reply_inquiry(uuid, text, text),
  public.admin_notify_user(uuid, text, text, text),
  public.admin_apply_university_name(uuid, text, text),
  public.admin_search_users(text, uuid, int),
  public.admin_user_detail(uuid)
to authenticated;

-- The auth hook must stay private to the Auth server.
revoke execute on function public.hook_before_user_created(jsonb) from authenticated;

-- Private schema: helpers that run inside RLS policies, invoker triggers and
-- invoker functions need EXECUTE for `authenticated`; everything else stays closed.
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function
  private.normalize_text(text),
  private.clean_text(text),
  private.clean_line(text),
  private.is_active_user(uuid),
  private.price_cap(int, int),
  private.isbn10_to_13(text),
  private.today_jst(),
  private.can_access_trade_files(text, boolean)
to authenticated;

grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
