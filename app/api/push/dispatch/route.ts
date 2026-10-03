import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { APP_URL, VAPID_PUBLIC_KEY } from "@/lib/env";
import { sendMail } from "@/lib/mailer";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Called by the database (pg_net) right after a notification or chat message is
// inserted. Sends Web Push to the recipient's devices, and e-mail for key events.

export const runtime = "nodejs";

const EMAIL_TYPES = new Set(["trade_requested", "meetup_confirmed", "handover_reported", "trade_cancelled", "inquiry_answered", "moderation"]);

type Payload = { title: string; body: string; url: string; tag?: string };

function authorized(request: NextRequest) {
  const expected = process.env.PUSH_DISPATCH_SECRET ?? "";
  const given = request.headers.get("x-dispatch-secret") ?? "";
  if (!expected || expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { source, id } = (await request.json().catch(() => ({}))) as { source?: string; id?: string };
  if (!id || (source !== "notifications" && source !== "messages")) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const admin = createSupabaseAdmin();
  let recipient: string | null = null;
  let payload: Payload | null = null;
  let email: { type: string; subject: string; text: string } | null = null;

  if (source === "notifications") {
    const { data: n } = await admin.from("notifications").select("*").eq("id", id).maybeSingle();
    if (!n) return NextResponse.json({ skipped: "not_found" });
    recipient = n.user_id;
    payload = { title: n.title, body: n.body ?? "", url: n.link ?? "/notifications", tag: n.trade_id ? `trade-${n.trade_id}` : n.type };
    if (EMAIL_TYPES.has(n.type)) {
      email = {
        type: n.type,
        subject: `【TextNext】${n.title}`,
        text: `${n.body ?? ""}\n\n${APP_URL}${n.link ?? "/notifications"}\n\n通知メールの設定はアプリの「設定」から変更できます。\n---\nTextNext`,
      };
    }
  } else {
    const { data: m } = await admin.from("messages").select("id, trade_id, sender_id, kind, body").eq("id", id).maybeSingle();
    if (!m || m.kind === "system" || !m.sender_id) return NextResponse.json({ skipped: "not_applicable" });
    const { data: trade } = await admin.from("trades").select("buyer_id, seller_id, item_title").eq("id", m.trade_id).maybeSingle();
    if (!trade) return NextResponse.json({ skipped: "no_trade" });
    const { data: sender } = await admin.from("profiles").select("nickname").eq("id", m.sender_id).maybeSingle();
    recipient = m.sender_id === trade.buyer_id ? trade.seller_id : trade.buyer_id;
    payload = {
      title: `${sender?.nickname ?? "取引相手"}（${trade.item_title}）`,
      body: m.kind === "image" ? "画像が届きました" : (m.body ?? "").slice(0, 140),
      url: `/trades/${m.trade_id}`,
      tag: `trade-${m.trade_id}`,
    };
  }

  let sent = 0;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (recipient && payload && privateKey && VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", VAPID_PUBLIC_KEY, privateKey);
    const { data: subscriptions } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", recipient);
    await Promise.all(
      (subscriptions ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "high" });
          sent++;
          await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
  }

  let mailed = false;
  if (recipient && email) {
    const { data: settings } = await admin.from("user_settings").select("email_notifications").eq("user_id", recipient).maybeSingle();
    if (settings?.email_notifications !== false) {
      const { data: user } = await admin.auth.admin.getUserById(recipient);
      if (user?.user?.email) mailed = await sendMail(user.user.email, email.subject, email.text).catch(() => false);
    }
  }

  return NextResponse.json({ sent, mailed });
}
