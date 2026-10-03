// Database functions raise short error codes (e.g. `raise exception 'item_reserved'`).
// This maps them to messages people can act on.
const MESSAGES: Record<string, string> = {
  not_authenticated: "ログインが必要です。もう一度ログインしてください",
  account_restricted: "アカウントが利用制限中のため、この操作はできません",
  admin_only: "管理者のみの操作です",

  // onboarding / profile
  email_not_confirmed: "メールアドレスの確認が完了していません",
  profile_exists: "プロフィールはすでに作成されています",
  terms_not_accepted: "利用規約への同意が必要です",
  university_unavailable: "このメールアドレスの大学は現在利用できません",
  nickname_taken: "このニックネームはすでに使われています",
  nickname_length: "ニックネームは2〜20文字で入力してください",
  nickname_not_allowed: "このニックネームは使えません",
  faculty_required: "学部・研究科を入力してください",
  invalid_campus: "キャンパスの指定が正しくありません",
  invalid_avatar_path: "画像のアップロードに失敗しました",

  // listings
  title_required: "書名を入力してください",
  price_above_cap: "販売価格が上限（定価の3割）を超えています",
  invalid_images: "写真は1〜4枚登録してください",
  invalid_image_path: "画像のアップロードに失敗しました。もう一度お試しください",
  listing_rate_limited: "1日に出品できる数の上限に達しました",
  item_locked: "取引中・売却済みの商品は編集できません",
  invalid_status: "この操作はできません",
  item_not_found: "商品が見つかりません",
  item_in_trade: "取引中の商品は削除できません。先に取引をキャンセルしてください",
  wish_limit_reached: "入荷通知は30件まで登録できます",

  // trades
  own_item: "自分の出品は購入できません",
  item_reserved: "ほかの人が取引中です。いいねしておくと、再び購入できるようになったときにお知らせします",
  item_not_available: "この商品は現在購入できません",
  seller_unavailable: "出品者が現在取引を受け付けていません",
  invalid_payment_method: "支払い方法を選んでください",
  too_many_open_trades: "同時に進められる取引は5件までです。進行中の取引を完了してから申し込んでください",
  request_rate_limited: "短時間に多くの申し込みがありました。時間をおいて再度お試しください",
  message_too_long: "メッセージが長すぎます",
  invalid_slots: "候補日時の指定が正しくありません",
  invalid_slot_date: "過去の日付や30日以上先の日付は選べません",
  not_enough_slots: "候補日時をもう少し選んでください",
  too_many_slots: "候補日時は12個までです",
  invalid_spot: "受け渡し場所の指定が正しくありません",
  spot_required: "受け渡し場所を選んでください",
  other_place_too_long: "場所の説明は60文字以内で入力してください",
  trade_not_found: "取引が見つかりません",
  trade_not_open: "この取引はすでに終了しています",
  note_too_long: "コメントが長すぎます",
  nothing_to_confirm: "確定できる候補がありません",
  cannot_confirm_own_proposal: "自分が出した候補は確定できません。相手の返事を待ちましょう",
  slot_not_in_proposal: "候補にない日時です",
  spot_not_in_proposal: "候補にない場所です",
  invalid_time: "時刻は7:00〜20:00の間で指定してください",
  only_seller: "出品者のみの操作です",
  only_buyer: "購入者のみの操作です",
  not_ratable: "今は評価できません",
  invalid_score: "評価を選んでください",
  comment_too_long: "コメントは200文字以内で入力してください",
  already_rated: "すでに評価済みです",
  trade_not_cancellable: "この取引はキャンセルできません",
  invalid_reason: "キャンセル理由を選んでください",
  note_required: "理由を具体的に入力してください",
  message_rate_limited: "メッセージの送信が多すぎます。少し時間をおいてください",
  invalid_message_kind: "このメッセージは送信できません",

  // admin
  university_name_taken: "同じ名前の大学がすでにあります。同じ大学なら、ドメインの追加か統合を使ってください",
  university_slug_taken: "このスラッグはほかの大学で使われています",

  // moderation
  report_rate_limited: "通報の上限に達しました。お問い合わせからご連絡ください",
  report_target_not_found: "通報の対象が見つかりません",
  email_required: "返信先のメールアドレスを入力してください",
  inquiry_rate_limited: "お問い合わせの上限に達しました。時間をおいて再度お試しください",
  invalid_request: "入力内容を確認してください",
};

type MaybeError = { message?: string; code?: string; details?: string } | null | undefined;

export function errorCode(error: unknown): string | null {
  const message = (error as MaybeError)?.message;
  if (!message) return null;
  return Object.prototype.hasOwnProperty.call(MESSAGES, message) ? message : null;
}

export function errorMessage(error: unknown, fallback = "エラーが発生しました。時間をおいて再度お試しください") {
  const e = error as MaybeError;
  const raw = e?.message ?? (typeof error === "string" ? error : "");
  if (raw && MESSAGES[raw]) return MESSAGES[raw];
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return "通信できませんでした。電波の良い場所で再度お試しください";
  if (/JWT|token is expired|refresh token/i.test(raw)) return "ログインの有効期限が切れました。もう一度ログインしてください";
  if (/violates row-level security|permission denied/i.test(raw)) return "この操作を行う権限がありません";
  return fallback;
}
