import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

// 1) anonymise data with the member's own session (delete_my_account),
// 2) remove their files and the auth user with the service role.
export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("delete_my_account");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { item_paths: itemPaths = [], avatar_path: avatarPath } = (data ?? {}) as { item_paths?: string[]; avatar_path?: string | null };

  const admin = createSupabaseAdmin();
  if (itemPaths.length > 0) await admin.storage.from("item-images").remove(itemPaths);
  if (avatarPath) await admin.storage.from("avatars").remove([avatarPath]);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return NextResponse.json({ error: "delete_failed" }, { status: 500 });

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
}
