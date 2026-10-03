import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Daily job (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
// Removes chat image files of trades closed more than 90 days ago; the
// database's own pg_cron job already purges the text messages.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: stale, error } = await admin.rpc("stale_chat_images", { p_limit: 500 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stale || stale.length === 0) return NextResponse.json({ removed: 0 });

  const { error: storageError } = await admin.storage.from("chat-images").remove(stale.map((s) => s.image_path));
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  await admin.from("messages").delete().in("id", stale.map((s) => s.message_id));
  return NextResponse.json({ removed: stale.length });
}
