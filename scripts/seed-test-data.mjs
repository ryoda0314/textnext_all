// Test data for local development. Run right after a reset:
//
//   npm run db:reset && npm run db:seed
//
//   テスト大学 (test-univ.ac.jp)     five members, ~20 listings, trades in every state
//   サンプル大学 (sample-univ.ac.jp) one member, to check that universities stay apart
//   admin@example.com               the operator console
//
// Everything goes through the app's own RPCs and policies, signed in as each member.
// Afterwards the timestamps are moved into the past (service role) so the feed, chats and
// reviews read like a few weeks of real use. Local Supabase only.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAIL, BOOKS, MEMBERS, PASSWORD, UNIVERSITIES, isbn13 } from "./seed/data.mjs";
import { renderPhoto } from "./seed/photos.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !secretKey) {
  console.error("Supabase の接続情報がありません。npm run db:seed から実行してください（.env.local を読み込みます）。");
  process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
  console.error(`${url} はローカルの Supabase ではないため中止しました。テストデータはローカル専用です。`);
  process.exit(1);
}

const TERMS_VERSION = readFileSync(new URL("../lib/constants.ts", import.meta.url), "utf8").match(/TERMS_VERSION = "([^"]+)"/)[1];
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secretKey, options);

async function call(request, label) {
  const { data, error } = await request;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ------------------------------------------------------------------- time ----

const DAY = 86_400_000;
/** JST calendar date, `offset` days from today. */
const jstDate = (offset = 0) => new Date(Date.now() + 9 * 3_600_000 + offset * DAY).toISOString().slice(0, 10);
const ago = (days, time) => new Date(`${jstDate(-days)}T${time}:00+09:00`);
const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000);
const listedAt = (listed) => (Array.isArray(listed) ? ago(...listed) : hoursAgo(listed.hoursAgo));
const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const toMs = (timestamp) => Date.parse(timestamp.replace(/(\.\d{3})\d+/, "$1"));
const slot = (offset, id) => ({ date: jstDate(offset), slot: id });

// --------------------------------------------------------------- accounts ----

async function signIn(email) {
  const client = createClient(url, publishableKey, options);
  const { user } = await call(client.auth.signInWithPassword({ email, password: PASSWORD }), `${email} でログイン`);
  return { client, id: user.id, email };
}

async function createAccount(email) {
  await call(service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }), `${email} の作成`);
  return signIn(email);
}

// The allow-listed admin may already exist (signed up by hand); reuse it with the test password.
async function adminAccount() {
  const { users } = await call(service.auth.admin.listUsers({ perPage: 1000 }), "ユーザー一覧");
  const existing = users.find((u) => u.email === ADMIN_EMAIL);
  if (!existing) return createAccount(ADMIN_EMAIL);
  await call(service.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true }), "管理者のパスワード");
  console.log(`既存の ${ADMIN_EMAIL} のパスワードを ${PASSWORD} にしました`);
  return signIn(ADMIN_EMAIL);
}

async function createUniversity(admin, u) {
  const id = await call(
    admin.client.rpc("admin_save_university", {
      p_id: null, p_name: u.name, p_short_name: u.shortName, p_slug: u.slug, p_status: "active", p_external_url: null,
      p_price_cap_percent: 30, p_meetup_slots: null, p_calil_system_id: null, p_name_verified: true,
    }),
    `${u.name} の作成`,
  );
  await call(admin.client.rpc("admin_set_domain", { p_domain: u.domain, p_university_id: id, p_include_subdomains: true }), `${u.domain} の登録`);
  const campuses = {};
  for (const [i, name] of u.campuses.entries()) {
    campuses[name] = await call(
      admin.client.rpc("admin_save_campus", { p_id: null, p_university_id: id, p_name: name, p_sort_order: (i + 1) * 10, p_is_active: true }),
      name,
    );
  }
  for (const [i, spot] of u.spots.entries()) {
    await call(
      admin.client.rpc("admin_save_spot", {
        p_id: null, p_university_id: id, p_campus_id: campuses[spot.campus] ?? null, p_name: spot.name,
        p_description: spot.description ?? null, p_sort_order: 50 + i * 10, p_is_active: true,
      }),
      spot.name,
    );
  }
  const spots = await call(service.from("meetup_spots").select("id, name").eq("university_id", id), "受け渡し場所");
  return { ...u, id, campuses, spots: Object.fromEntries(spots.map((s) => [s.name, s.id])) };
}

async function join(key, university) {
  const m = MEMBERS[key];
  const account = await createAccount(m.email);
  await call(
    account.client.rpc("complete_profile", {
      p_nickname: m.nickname, p_faculty: m.faculty, p_department: m.department, p_grade: m.grade,
      p_campus_id: m.campus ? university.campuses[m.campus] : null, p_terms_version: TERMS_VERSION, p_university_name: null,
    }),
    `${m.nickname} のプロフィール`,
  );
  if (m.bio) await call(account.client.from("profiles").update({ bio: m.bio }).eq("id", account.id), "自己紹介");
  await call(service.from("profiles").update({ created_at: ago(m.joinedDaysAgo, "21:00").toISOString() }).eq("id", account.id), "登録日");
  return { ...m, ...account, key, university };
}

// --------------------------------------------------------------- listings ----

const items = {};

async function list(key, members) {
  const book = BOOKS[key];
  const seller = members[book.seller];
  const images = [];
  for (const kind of book.photos) {
    const photo = await renderPhoto(kind, book, seller.desk);
    const base = `${seller.university.id}/${seller.id}/${randomUUID()}`;
    for (const [path, body] of [[`${base}.webp`, photo.full], [`${base}_t.webp`, photo.thumb]]) {
      await call(seller.client.storage.from("item-images").upload(path, body, { contentType: "image/webp", cacheControl: "31536000" }), `${book.title} の写真`);
    }
    images.push({ path: `${base}.webp`, thumb: `${base}_t.webp`, w: photo.width, h: photo.height });
  }
  const { id } = await call(
    seller.client
      .from("items")
      .insert({
        title: book.title, author: book.author, publisher: book.publisher, isbn: book.isbn, course_name: book.course,
        description: book.description, condition: book.condition, writing: book.writing,
        list_price: book.listPrice, price: book.price, images,
      })
      .select("id")
      .single(),
    `${book.title} の出品`,
  );
  const at = listedAt(book.listed);
  await call(service.from("items").update({ created_at: at.toISOString() }).eq("id", id), "出品日時");
  // 入荷通知 this listing triggered.
  const alerts = await call(service.from("notifications").select("id").eq("item_id", id), "入荷通知");
  for (const alert of alerts) {
    await call(service.from("notifications").update({ created_at: new Date(at.getTime() + 60_000).toISOString() }).eq("id", alert.id), "入荷通知の日時");
  }
  items[key] = { id, seller };
}

// ----------------------------------------------------------------- trades ----

const TRADE_TIMES = [
  "created_at", "last_message_at", "meetup_confirmed_at", "buyer_confirmed_at", "seller_confirmed_at",
  "handed_over_at", "completed_at", "cancelled_at", "buyer_read_at", "seller_read_at",
];
const trades = [];

async function snapshot(ctx) {
  const notifications = await call(
    service.from("notifications").select("id, created_at").or(ctx.tradeId ? `trade_id.eq.${ctx.tradeId},item_id.eq.${ctx.itemId}` : `item_id.eq.${ctx.itemId}`),
    "通知",
  );
  if (!ctx.tradeId) return { trade: null, messages: [], ratings: [], notifications };
  const [trade, messages, ratings] = await Promise.all([
    call(service.from("trades").select("*").eq("id", ctx.tradeId).single(), "取引"),
    call(service.from("messages").select("id, created_at").eq("trade_id", ctx.tradeId), "メッセージ"),
    call(service.from("ratings").select("rater_id, created_at").eq("trade_id", ctx.tradeId), "評価"),
  ]);
  return { trade, messages, ratings, notifications };
}

/** Runs one action of a trade, then moves everything it wrote to `at`, keeping the order within the step. */
async function step(ctx, at, action) {
  const before = await snapshot(ctx);
  const result = await action();
  ctx.tradeId ??= result;
  const after = await snapshot(ctx);

  const added = (kind, key) => after[kind].filter((row) => !before[kind].some((old) => old[key] === row[key]));
  const messages = added("messages", "id").sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const notifications = added("notifications", "id");
  const ratings = added("ratings", "rater_id");
  const fields = TRADE_TIMES.filter((f) => after.trade[f] && after.trade[f] !== before.trade?.[f]);
  const stamps = [...messages, ...notifications, ...ratings].map((r) => toMs(r.created_at)).concat(fields.map((f) => toMs(after.trade[f])));
  if (stamps.length === 0) return;
  const origin = Math.min(...stamps);
  const move = (timestamp) => new Date(at.getTime() + toMs(timestamp) - origin).toISOString();

  const patch = Object.fromEntries(fields.map((f) => [f, move(after.trade[f])]));
  if (after.trade.proposal && JSON.stringify(after.trade.proposal) !== JSON.stringify(before.trade?.proposal)) {
    patch.proposal = { ...after.trade.proposal, at: move(after.trade.proposal.at) };
  }
  let last = 0;
  const messageTimes = messages.map((m) => {
    last = Math.max(toMs(move(m.created_at)), last + 1);
    return [m.id, new Date(last).toISOString()];
  });
  await Promise.all([
    call(service.from("trades").update(patch).eq("id", ctx.tradeId), "取引の日時"),
    ...messageTimes.map(([id, time]) => call(service.from("messages").update({ created_at: time }).eq("id", id), "メッセージの日時")),
    ...notifications.map((n) => call(service.from("notifications").update({ created_at: move(n.created_at) }).eq("id", n.id), "通知の日時")),
    ...ratings.map((r) =>
      call(service.from("ratings").update({ created_at: move(r.created_at) }).eq("trade_id", ctx.tradeId).eq("rater_id", r.rater_id), "評価の日時"),
    ),
  ]);
  if (patch.handed_over_at) {
    await call(service.from("items").update({ sold_at: patch.handed_over_at }).eq("id", ctx.itemId).eq("status", "sold"), "売れた日時");
  }
}

/** "10/5(月)", as private.format_meetup() writes dates into notification texts. */
function meetupLabel(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${"日月火水木金土"[d.getUTCDay()]})`;
}

/** For trades that happened in the past: moves the meet-up date and proposed dates back by `days`. */
async function backdateMeetup(ctx, days) {
  const trade = await call(service.from("trades").select("meetup_date").eq("id", ctx.tradeId).single(), "取引");
  if (trade.meetup_date) {
    const moved = shiftDate(trade.meetup_date, -days);
    await call(service.from("trades").update({ meetup_date: moved }).eq("id", ctx.tradeId), "受け渡し日");
    const notices = await call(service.from("notifications").select("id, body").eq("trade_id", ctx.tradeId).eq("type", "meetup_confirmed"), "通知");
    for (const { id, body } of notices) {
      await call(service.from("notifications").update({ body: body.replace(meetupLabel(trade.meetup_date), meetupLabel(moved)) }).eq("id", id), "通知の日付");
    }
  }
  const messages = await call(service.from("messages").select("id, payload").eq("trade_id", ctx.tradeId).not("payload", "is", null), "メッセージ");
  for (const { id, payload } of messages) {
    const next = structuredClone(payload);
    if (Array.isArray(next.slots)) next.slots = next.slots.map((s) => ({ ...s, date: shiftDate(s.date, -days) }));
    if (next.date) next.date = shiftDate(next.date, -days);
    if (next.previous?.date) next.previous.date = shiftDate(next.previous.date, -days);
    if (JSON.stringify(next) !== JSON.stringify(payload)) await call(service.from("messages").update({ payload: next }).eq("id", id), "候補日");
  }
}

function tradeActions(members) {
  const spotIds = (member, names) => names.map((name) => member.university.spots[name]);
  return {
    async request(buyerKey, itemKey, at, { slots, spots, payment, message }) {
      const buyer = members[buyerKey];
      const ctx = { itemId: items[itemKey].id, buyer, seller: items[itemKey].seller };
      await step(ctx, at, () =>
        call(
          buyer.client.rpc("request_trade", {
            p_item_id: ctx.itemId, p_payment_method: payment, p_slots: slots, p_spot_ids: spotIds(buyer, spots),
            p_other_place: null, p_message: message,
          }),
          `${BOOKS[itemKey].title} の取引リクエスト`,
        ),
      );
      trades.push(ctx);
      return ctx;
    },
    say: (ctx, who, at, body) => step(ctx, at, () => call(who.client.from("messages").insert({ trade_id: ctx.tradeId, kind: "text", body }), "メッセージ")),
    propose: (ctx, who, at, { slots, spots, note }) =>
      step(ctx, at, () =>
        call(who.client.rpc("propose_meetup", { p_trade_id: ctx.tradeId, p_slots: slots, p_spot_ids: spotIds(who, spots), p_other_place: null, p_note: note }), "候補の再提案"),
      ),
    confirm: (ctx, at, { date, slot: slotId, spot, time }) =>
      step(ctx, at, () =>
        call(
          ctx.seller.client.rpc("confirm_meetup", { p_trade_id: ctx.tradeId, p_date: date, p_slot: slotId, p_spot_id: ctx.seller.university.spots[spot], p_time: time }),
          "日時の確定",
        ),
      ),
    handOver: (ctx, at) =>
      step(ctx, at, async () => {
        const { code } = await call(ctx.seller.client.rpc("issue_handover_code", { p_trade_id: ctx.tradeId }), "受け渡しコード");
        const result = await call(ctx.buyer.client.rpc("complete_handover", { p_trade_id: ctx.tradeId, p_code: code }), "受け渡し");
        if (!result.ok) throw new Error(`受け渡しに失敗しました: ${JSON.stringify(result)}`);
      }),
    rate: (ctx, who, at, score, comment = null) =>
      step(ctx, at, () => call(who.client.rpc("rate_trade", { p_trade_id: ctx.tradeId, p_score: score, p_comment: comment }), "評価")),
    cancel: (ctx, who, at, reason) =>
      step(ctx, at, () => call(who.client.rpc("cancel_trade", { p_trade_id: ctx.tradeId, p_reason: reason, p_note: null }), "キャンセル")),
  };
}

// ------------------------------------------------------------------- main ----

async function main() {
  const slugs = Object.values(UNIVERSITIES).map((u) => u.slug);
  const existing = await call(service.from("universities").select("slug").in("slug", slugs), "既存データの確認");
  if (existing.length > 0) {
    console.error("テストデータはすでに入っています。作り直すときは npm run db:reset（ローカルのデータがすべて消えます）のあとに、もう一度実行してください。");
    process.exit(1);
  }

  const admin = await adminAccount();
  const universities = {};
  for (const [key, u] of Object.entries(UNIVERSITIES)) universities[key] = await createUniversity(admin, u);

  const members = {};
  for (const key of Object.keys(MEMBERS)) members[key] = await join(key, universities[MEMBERS[key].university]);
  const { taro, hanako, kenta, sakura, yuto } = members;

  // 入荷通知 first, so the matching listing below notifies はなこ.
  const wishes = [
    [hanako, { keyword: "解析入門", label: "解析入門" }, ago(5, "22:30")],
    [hanako, { isbn: isbn13("978400005424"), label: "集合・位相入門（松坂和夫）" }, ago(5, "22:32")],
    [yuto, { keyword: "電気回路", label: "電気回路" }, ago(9, "20:00")],
  ];
  for (const [member, fields, at] of wishes) {
    const { id } = await call(member.client.from("wishes").insert(fields).select("id").single(), "入荷通知の登録");
    await call(service.from("wishes").update({ created_at: at.toISOString() }).eq("id", id), "入荷通知の日時");
  }

  for (const key of Object.keys(BOOKS)) await list(key, members);

  for (const [who, itemKeys] of [
    [hanako, ["psychology", "mechanics", "macro", "writing"]],
    [yuto, ["dynamics", "thermo"]],
    [kenta, ["writing", "biology"]],
    [sakura, ["econmath", "stats"]],
    [taro, ["biology"]],
  ]) {
    for (const key of itemKeys) await call(who.client.from("favorites").insert({ item_id: items[key].id }), "いいね");
  }

  const t = tradeActions(members);

  // Completed, about a month ago: けんた bought たろう's K&R.
  const kr = await t.request("kenta", "clang", ago(32, "20:15"), {
    slots: [slot(1, "lunch"), slot(2, "lunch")], spots: ["図書館前", "生協・購買前"], payment: "cash",
    message: "プログラミング基礎を履修するので購入したいです。",
  });
  await t.confirm(kr, ago(32, "21:40"), { date: jstDate(2), slot: "lunch", spot: "図書館前", time: "12:20" });
  await t.say(kr, taro, ago(32, "21:41"), "ありがとうございます。図書館前で12:20にお待ちしています。");
  await t.handOver(kr, ago(30, "12:24"));
  await t.rate(kr, kenta, ago(30, "12:50"), "good", "とても丁寧な方でした。ありがとうございました！");
  await t.rate(kr, taro, ago(30, "18:05"), "good", "スムーズな取引ありがとうございました。");
  await backdateMeetup(kr, 32);

  // Completed, three weeks ago, with a 「普通」 rating: さくら bought けんた's ミクロ経済学の力.
  const micro = await t.request("sakura", "micro", ago(22, "19:30"), {
    slots: [slot(1, "afternoon"), slot(2, "afternoon")], spots: ["経済学部棟 入口"], payment: "either",
    message: "他学部履修でミクロ経済学をとるので、ゆずっていただけるとうれしいです。",
  });
  await t.say(micro, kenta, ago(22, "22:10"), "ありがとうございます！2日目の午後でお願いします。");
  await t.confirm(micro, ago(22, "22:11"), { date: jstDate(2), slot: "afternoon", spot: "経済学部棟 入口", time: "16:00" });
  await t.say(micro, sakura, ago(21, "08:02"), "承知しました。よろしくお願いします。");
  await t.handOver(micro, ago(20, "16:12"));
  await t.rate(micro, sakura, ago(20, "17:30"), "normal", "待ち合わせに10分ほど遅れて来られましたが、本はきれいでした。");
  await t.rate(micro, kenta, ago(20, "21:15"), "good", "丁寧にやりとりしていただきありがとうございました。");
  await backdateMeetup(micro, 22);

  // Completed, twelve days ago: はなこ bought たろう's 微分積分学.
  const calc = await t.request("hanako", "calculus", ago(14, "21:05"), {
    slots: [slot(1, "lunch"), slot(2, "lunch"), slot(2, "afternoon")], spots: ["図書館前", "学生食堂前"], payment: "cash",
    message: "微分積分学Iで使う予定です。よろしくお願いします。",
  });
  await t.confirm(calc, ago(13, "07:45"), { date: jstDate(2), slot: "lunch", spot: "学生食堂前", time: "12:15" });
  await t.say(calc, taro, ago(13, "07:46"), "おはようございます。学生食堂前に12:15でどうでしょうか。");
  await t.say(calc, hanako, ago(13, "08:30"), "大丈夫です！よろしくお願いします。");
  await t.handOver(calc, ago(12, "12:18"));
  await t.rate(calc, hanako, ago(12, "12:40"), "good", "授業のことも教えていただきました。ありがとうございました！");
  await t.rate(calc, taro, ago(12, "20:10"), "good");
  await backdateMeetup(calc, 14);

  // Completed, last week: ゆうと bought たろう's 電磁気学 (cashless).
  const em = await t.request("yuto", "em", ago(8, "20:10"), {
    slots: [slot(1, "lunch"), slot(2, "lunch")], spots: ["図書館前", "工学部1号館 ロビー"], payment: "cashless",
    message: "電磁気学Aで使います。PayPayでも大丈夫でしょうか？",
  });
  await t.say(em, taro, ago(8, "21:00"), "PayPayで大丈夫です！");
  await t.confirm(em, ago(8, "21:01"), { date: jstDate(2), slot: "lunch", spot: "工学部1号館 ロビー", time: "12:30" });
  await t.say(em, yuto, ago(8, "21:20"), "ありがとうございます。よろしくお願いします！");
  await t.handOver(em, ago(6, "12:33"));
  await t.rate(em, yuto, ago(6, "13:10"), "good", "説明どおりきれいでした。ありがとうございました。");
  await t.rate(em, taro, ago(6, "19:45"), "good", "スムーズな取引ありがとうございました。");
  await backdateMeetup(em, 8);

  // Cancelled by the buyer: the listing went back on sale and はなこ (who liked it) was told.
  const macro = await t.request("yuto", "macro", ago(4, "22:05"), {
    slots: [slot(1, "lunch"), slot(2, "lunch")], spots: ["生協・購買前"], payment: "cash",
    message: "マクロ経済学を履修する予定なので購入希望です。",
  });
  await t.say(macro, kenta, ago(3, "08:30"), "ありがとうございます！どちらの日程でも大丈夫です。");
  await t.say(macro, yuto, ago(3, "12:10"), "すみません、履修をやめることにしたのでキャンセルさせてください。");
  await t.cancel(macro, yuto, ago(3, "12:11"), "buyer_withdrew");
  await backdateMeetup(macro, 4);

  // Handed over yesterday; けんた has rated, さくら still has to.
  const soc = await t.request("kenta", "sociology", ago(3, "12:15"), {
    slots: [slot(1, "afternoon"), slot(2, "lunch")], spots: ["図書館前", "経済学部棟 入口"], payment: "either",
    message: "一般教養の社会学で使います。よろしくお願いします。",
  });
  await t.confirm(soc, ago(3, "18:30"), { date: jstDate(2), slot: "lunch", spot: "図書館前", time: "12:20" });
  await t.say(soc, sakura, ago(3, "18:31"), "日程ありがとうございます。図書館前で12:20にお待ちしています。");
  await t.say(soc, kenta, ago(2, "09:12"), "了解です。紺色のパーカーで行きます。");
  await t.handOver(soc, ago(1, "12:24"));
  await t.rate(soc, kenta, ago(1, "13:05"), "good", "きれいな状態で助かりました。ありがとうございました！");
  await backdateMeetup(soc, 3);

  // Scheduled for tomorrow's lunch break.
  const mat = await t.request("yuto", "materials", ago(2, "19:05"), {
    slots: [slot(1, "lunch"), slot(2, "afternoon")], spots: ["生協・購買前", "図書館前"], payment: "cashless",
    message: "材料力学Iの授業で使いたいです。よろしくお願いします。",
  });
  await t.confirm(mat, ago(2, "20:40"), { date: jstDate(1), slot: "lunch", spot: "生協・購買前", time: "12:30" });
  await t.say(mat, taro, ago(2, "20:41"), "ありがとうございます。当日は黒いリュックで行きます。支払いはPayPayでお願いします。");
  await t.say(mat, yuto, ago(2, "21:02"), "了解です！よろしくお願いします。");

  // The seller suggested other dates; はなこ has to pick one.
  const stats = await t.request("hanako", "stats", ago(1, "21:10"), {
    slots: [slot(1, "morning"), slot(1, "lunch")], spots: ["生協・購買前"], payment: "cash",
    message: "統計学基礎の授業で使います。よろしくお願いします。",
  });
  await t.say(stats, kenta, ago(1, "22:30"), "ご連絡ありがとうございます！その日は北キャンパスに行けないので、別の日程を送りますね。");
  await t.propose(stats, kenta, ago(1, "22:31"), {
    slots: [slot(2, "lunch"), slot(3, "lunch"), slot(3, "afternoon")], spots: ["図書館前", "経済学部棟 入口"],
    note: "南キャンパスだと助かります",
  });

  // A new request for たろう, two hours ago.
  const linear = await t.request("hanako", "linear", hoursAgo(2), {
    slots: [slot(1, "lunch"), slot(2, "lunch"), slot(2, "afternoon")], spots: ["図書館前", "学生食堂前"], payment: "either",
    message: "はじめまして。線形代数学Iで使うので購入したいです。よろしくお願いします！",
  });

  // Older activity has been seen; the newest things stay unread so the badges show up.
  const unreadTrades = new Set([`${linear.tradeId}:${taro.id}`, `${stats.tradeId}:${hanako.id}`, `${soc.tradeId}:${sakura.id}`]);
  for (const ctx of trades) {
    for (const m of [ctx.buyer, ctx.seller]) {
      if (!unreadTrades.has(`${ctx.tradeId}:${m.id}`)) await call(m.client.rpc("mark_trade_read", { p_trade_id: ctx.tradeId }), "既読");
    }
  }

  // Support desk and moderation queue for the admin console.
  const inquiry = await call(
    hanako.client.rpc("submit_inquiry", {
      p_category: "request", p_body: "北キャンパスの理学部棟の前も受け渡し場所に追加してもらえると助かります。", p_email: null,
    }),
    "お問い合わせ",
  );
  await call(
    admin.client.rpc("admin_save_spot", {
      p_id: null, p_university_id: universities.test.id, p_campus_id: universities.test.campuses["北キャンパス"], p_name: "理学部棟 前",
      p_description: null, p_sort_order: 70, p_is_active: true,
    }),
    "受け渡し場所の追加",
  );
  await call(
    admin.client.rpc("admin_reply_inquiry", {
      p_inquiry_id: inquiry, p_reply: "ご要望ありがとうございます。北キャンパスの受け渡し場所に「理学部棟 前」を追加しました。", p_status: "answered",
    }),
    "お問い合わせへの返信",
  );
  await call(service.from("inquiries").update({ created_at: ago(6, "21:40").toISOString(), replied_at: ago(5, "10:15").toISOString() }).eq("id", inquiry), "お問い合わせの日時");
  await call(service.from("notifications").update({ created_at: ago(5, "10:15").toISOString() }).eq("user_id", hanako.id).eq("type", "inquiry_answered"), "返信通知の日時");

  const bug = await call(
    yuto.client.rpc("submit_inquiry", {
      p_category: "bug", p_body: "取引画面で写真を送ると、たまに読み込みが終わらないことがあります。iPhoneのSafariです。", p_email: null,
    }),
    "お問い合わせ",
  );
  await call(service.from("inquiries").update({ created_at: hoursAgo(20).toISOString() }).eq("id", bug), "お問い合わせの日時");

  const report = await call(
    yuto.client.rpc("submit_report", {
      p_target_type: "item", p_target_id: items.econmath.id, p_reason: "misleading",
      p_detail: "表紙の写真は第2版ですが、説明には第3版と書かれています。どちらが正しいか確認をお願いします。",
    }),
    "通報",
  );
  await call(service.from("reports").update({ created_at: hoursAgo(26).toISOString() }).eq("id", report), "通報の日時");

  const guest = createClient(url, publishableKey, options);
  await call(guest.rpc("request_university", { p_email: "student@hoshizora-college.test", p_university_name: "星空カレッジ", p_contact_email: null }), "大学の追加リクエスト");

  // Notifications: everything older has been read, except what the unread trades and the wish match produced.
  const memberIds = Object.values(members).map((m) => m.id);
  await call(service.from("notifications").update({ read_at: new Date().toISOString() }).in("user_id", memberIds).is("read_at", null), "通知を既読に");
  for (const match of [
    { user_id: taro.id, trade_id: linear.tradeId },
    { user_id: hanako.id, trade_id: stats.tradeId },
    { user_id: hanako.id, item_id: items.analysis.id, type: "wish_match" },
    { user_id: sakura.id, trade_id: soc.tradeId, type: "handover_done" },
    { user_id: sakura.id, trade_id: soc.tradeId, type: "rating_received" },
  ]) {
    await call(service.from("notifications").update({ read_at: null }).match(match), "未読に戻す");
  }

  printSummary(universities, members);
}

function printSummary(universities, members) {
  const rows = (universityKey) =>
    Object.values(members)
      .filter((m) => m.university.slug === universities[universityKey].slug)
      .map((m) => `  ${m.email.padEnd(26)} ${m.nickname}（${m.faculty} ${m.grade}）  ${m.role}`);
  console.log(
    [
      "",
      "テストデータを作成しました。パスワードは全員 " + PASSWORD,
      "",
      `${universities.test.name}（${universities.test.domain}）`,
      ...rows("test"),
      "",
      `${universities.sample.name}（${universities.sample.domain}）`,
      ...rows("sample"),
      "",
      "運営",
      `  ${ADMIN_EMAIL.padEnd(26)} 管理画面 /admin`,
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(`\n途中で失敗しました: ${error.message}`);
  console.error("npm run db:reset でローカルのデータを消してから、もう一度実行してください。");
  process.exit(1);
});
