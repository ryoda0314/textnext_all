const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function yen(value: number) {
  return value === 0 ? "無料" : `¥${value.toLocaleString("ja-JP")}`;
}

/** Mirrors private.normalize_text() in SQL. */
export function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Today's date in Japan as YYYY-MM-DD. */
export function todayJst(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return now.toISOString().slice(0, 10);
}

/** Parses YYYY-MM-DD as a calendar date (no timezone shifts). */
function parseDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function dateLabel(date: string, withWeekday = true) {
  const { m, d, dow } = parseDate(date);
  return withWeekday ? `${m}/${d}(${WEEKDAYS[dow]})` : `${m}/${d}`;
}

export function relativeDayLabel(date: string) {
  if (date === todayJst()) return "今日";
  if (date === todayJst(1)) return "明日";
  if (date === todayJst(2)) return "明後日";
  return null;
}

export function isWeekend(date: string) {
  const { dow } = parseDate(date);
  return dow === 0 || dow === 6;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function clockTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "今日";
  if (d.toDateString() === yesterday.toDateString()) return "昨日";
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}
