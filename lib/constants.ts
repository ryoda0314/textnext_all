export const APP_NAME = "TextNext";
export const TERMS_VERSION = "2026-10-03";

export const CONDITIONS = {
  like_new: { label: "新品同様", hint: "使用感がほとんどない" },
  good: { label: "目立った傷なし", hint: "多少の使用感はある" },
  fair: { label: "やや傷・汚れあり", hint: "表紙の傷や角の折れなど" },
  poor: { label: "傷・汚れあり", hint: "読むのに支障はない" },
} as const;
export type Condition = keyof typeof CONDITIONS;

export const WRITING = {
  none: { label: "書き込みなし" },
  some: { label: "書き込み少し" },
  lots: { label: "書き込み多め" },
} as const;
export type Writing = keyof typeof WRITING;

export const GRADES = [
  { value: "B1", label: "学部1年" },
  { value: "B2", label: "学部2年" },
  { value: "B3", label: "学部3年" },
  { value: "B4", label: "学部4年" },
  { value: "B5", label: "学部5年" },
  { value: "B6", label: "学部6年" },
  { value: "M1", label: "修士1年" },
  { value: "M2", label: "修士2年" },
  { value: "D1", label: "博士1年" },
  { value: "D2", label: "博士2年" },
  { value: "D3", label: "博士3年" },
  { value: "staff", label: "教職員" },
  { value: "other", label: "その他" },
] as const;
export type Grade = (typeof GRADES)[number]["value"];

export function gradeLabel(value: string | null | undefined) {
  return GRADES.find((g) => g.value === value)?.label ?? null;
}

export const PAYMENT_METHODS = {
  cash: { label: "現金", hint: "受け渡し時に手渡し" },
  cashless: { label: "キャッシュレス", hint: "PayPayなどで受け渡し時に" },
  either: { label: "どちらでも", hint: "相手に合わせます" },
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const CANCEL_REASONS = {
  schedule_mismatch: { label: "日程が合わなかった", who: "both" },
  buyer_withdrew: { label: "購入をやめる", who: "buyer" },
  seller_withdrew: { label: "出品をやめる（商品は非公開になります）", who: "seller" },
  no_response: { label: "相手から返信がない", who: "both" },
  other: { label: "その他", who: "both" },
} as const;
export type CancelReason = keyof typeof CANCEL_REASONS;

export const SYSTEM_CANCEL_LABELS: Record<string, string> = {
  expired: "一定期間やり取りがなかったため自動キャンセル",
  expired_after_meetup: "受け渡し予定日から完了確認がなかったため自動キャンセル",
  account_deleted: "取引相手が退会したためキャンセル",
  admin: "運営によりキャンセル",
};

export const REPORT_REASONS = {
  prohibited_item: "出品が禁止されているもの（コピー・図書館の本など）",
  misleading: "写真・説明が実物と違う",
  harassment: "迷惑行為・嫌がらせ",
  no_show: "約束の場所に来なかった",
  external_contact: "外部の連絡先を求められた",
  spam: "営利目的・スパム",
  other: "その他",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const INQUIRY_CATEGORIES = {
  account: "アカウント・ログイン",
  trade: "取引のトラブル",
  bug: "不具合の報告",
  university: "大学・メールドメインについて",
  request: "ご要望",
  other: "その他",
} as const;
export type InquiryCategory = keyof typeof INQUIRY_CATEGORIES;

export const RATING_SCORES = {
  good: { label: "良かった", short: "良い" },
  normal: { label: "普通", short: "普通" },
  bad: { label: "残念だった", short: "残念" },
} as const;
export type RatingScore = keyof typeof RATING_SCORES;

export const LIMITS = {
  listPriceMax: 50000,
  titleMax: 100,
  authorMax: 100,
  publisherMax: 60,
  courseMax: 60,
  descriptionMax: 500,
  imagesMax: 4,
  messageMax: 1000,
  requestMessageMax: 500,
  nicknameMin: 2,
  nicknameMax: 20,
  affiliationMax: 40,
  bioMax: 160,
  ratingCommentMax: 200,
  minRequestSlots: 2,
  maxSlots: 12,
  slotDaysAhead: 14,
} as const;

/** Highest allowed price: list price × cap%, floored to 10 yen. Mirrors private.price_cap() in SQL. */
export function priceCap(listPrice: number, capPercent: number) {
  if (!Number.isFinite(listPrice) || listPrice <= 0) return 0;
  return Math.floor((Math.floor(listPrice) * capPercent) / 1000) * 10;
}
