// Fixtures for scripts/seed-test-data.mjs. Bibliographic details follow real textbooks
// where well known; prices and ISBN check digits are test values.

export const PASSWORD = "test1234";
export const ADMIN_EMAIL = "admin@example.com"; // allow-listed in supabase/seed.sql

export const UNIVERSITIES = {
  test: {
    name: "テスト大学",
    shortName: "テスト大",
    slug: "test-univ",
    domain: "test-univ.ac.jp",
    campuses: ["北キャンパス", "南キャンパス"],
    // In addition to the default spots every university gets (図書館前, 生協・購買前, 学生食堂前, 正門前).
    spots: [
      { name: "工学部1号館 ロビー", campus: "北キャンパス", description: "正面入口を入ってすぐ" },
      { name: "経済学部棟 入口", campus: "南キャンパス" },
    ],
  },
  // A second university, to check that members only ever see their own campus market.
  sample: {
    name: "サンプル大学",
    shortName: "サンプル大",
    slug: "sample-univ",
    domain: "sample-univ.ac.jp",
    campuses: [],
    spots: [],
  },
};

export const MEMBERS = {
  taro: {
    university: "test",
    email: "taro@test-univ.ac.jp",
    nickname: "たろう",
    faculty: "工学部",
    department: "機械工学科",
    grade: "B3",
    campus: "北キャンパス",
    joinedDaysAgo: 70,
    desk: "wood",
    bio: "機械工学科の3年です。使い終わった教科書を出品しています。受け渡しは北キャンパスの昼休みが多いです。",
    role: "出品が多い先輩。新しい取引リクエストが届いている",
  },
  hanako: {
    university: "test",
    email: "hanako@test-univ.ac.jp",
    nickname: "はなこ",
    faculty: "理学部",
    department: "数学科",
    grade: "B1",
    campus: "北キャンパス",
    joinedDaysAgo: 20,
    desk: "blue",
    bio: "数学科の1年です。よろしくお願いします。",
    role: "購入中心の1年生。日程の再提案と入荷通知が届いている",
  },
  kenta: {
    university: "test",
    email: "kenta@test-univ.ac.jp",
    nickname: "けんた",
    faculty: "経済学部",
    department: "経済学科",
    grade: "B2",
    campus: "南キャンパス",
    joinedDaysAgo: 45,
    desk: "gray",
    bio: "経済学部の2年です。平日の昼休みなら南キャンパスで受け渡しできます。",
    role: "出品も購入もする。評価の「普通」も1件ある",
  },
  sakura: {
    university: "test",
    email: "sakura@test-univ.ac.jp",
    nickname: "さくら",
    faculty: "文学部",
    department: "人文学科",
    grade: "M1",
    campus: "南キャンパス",
    joinedDaysAgo: 60,
    desk: "white",
    bio: "文学部の院生です。学部時代の教科書を少しずつ出品しています。",
    role: "受け渡し済みで、相手の評価待ち（自分の評価がまだ）",
  },
  yuto: {
    university: "test",
    email: "yuto@test-univ.ac.jp",
    nickname: "ゆうと",
    faculty: "工学部",
    department: "電気電子工学科",
    grade: "B1",
    campus: "北キャンパス",
    joinedDaysAgo: 15,
    desk: "dark",
    bio: null,
    role: "明日の昼休みに受け渡し予定の取引がある",
  },
  jiro: {
    university: "sample",
    email: "jiro@sample-univ.ac.jp",
    nickname: "じろう",
    faculty: "工学部",
    department: "情報工学科",
    grade: "B2",
    campus: null,
    joinedDaysAgo: 30,
    desk: "gray",
    bio: null,
    role: "サンプル大学の学生。テスト大学の出品は見えない",
  },
};

/** 13-digit ISBN from its first 12 digits. */
export function isbn13(stem) {
  const sum = [...stem].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return stem + ((10 - (sum % 10)) % 10);
}

const book = ({ isbn, ...rest }) => ({ ...rest, isbn: isbn13(isbn) });

// listed: when it was put up — [days ago, "HH:MM" JST], or { hoursAgo }.
export const BOOKS = {
  // ---- たろう (工学部 機械工学科)
  linear: book({
    seller: "taro", title: "線形代数入門", author: "齋藤正彦", publisher: "東京大学出版会", isbn: "978413062001",
    listPrice: 2090, price: 600, condition: "good", writing: "some", course: "線形代数学I",
    description: "1年前期の線形代数学Iで使いました。数ページに鉛筆の書き込みがあります（消しゴムで消せます）。",
    listed: [9, "21:14"], photos: ["cover", "inside", "back"],
    cover: { style: "solid", color: "#24365f", series: "基礎数学 1" },
  }),
  materials: book({
    seller: "taro", title: "材料力学", author: "日本機械学会 編", publisher: "日本機械学会", isbn: "978488898119",
    listPrice: 2090, price: 600, condition: "good", writing: "some", course: "材料力学I",
    description: "授業の指定教科書です。重要なところにマーカーを引いています。演習問題の解答は書き込んでいません。",
    listed: [6, "22:40"], photos: ["cover", "inside"],
    cover: { style: "band", color: "#4f5f2a", series: "JSMEテキストシリーズ" },
  }),
  thermo: book({
    seller: "taro", title: "熱力学", author: "日本機械学会 編", publisher: "日本機械学会", isbn: "978488898165",
    listPrice: 2090, price: 620, condition: "like_new", writing: "none", course: "熱力学I",
    description: "ほとんど開かなかったのできれいです。",
    listed: [5, "20:02"], photos: ["cover"],
    cover: { style: "band", color: "#7a2f2f", series: "JSMEテキストシリーズ" },
  }),
  dynamics: book({
    seller: "taro", title: "機械力学", author: "日本機械学会 編", publisher: "日本機械学会", isbn: "978488898184",
    listPrice: 2200, price: 600, condition: "good", writing: "none", course: "機械力学",
    description: "2年後期の機械力学で使用しました。表紙に少しすれがあります。",
    listed: [2, "18:25"], photos: ["cover", "back"],
    cover: { style: "band", color: "#1f4e5f", series: "JSMEテキストシリーズ" },
  }),
  em: book({
    seller: "taro", title: "電磁気学", author: "長岡洋介", publisher: "岩波書店", isbn: "978400029863",
    listPrice: 2970, price: 800, condition: "good", writing: "some", course: "電磁気学A",
    description: "物理入門コースの電磁気学です。章末問題に少し書き込みがあります。",
    listed: [12, "19:40"], photos: ["cover", "inside"],
    cover: { style: "frame", color: "#2d3e50", subtitle: "物理入門コース 3" },
  }),
  calculus: book({
    seller: "taro", title: "微分積分学", author: "笠原晧司", publisher: "サイエンス社", isbn: "978478190042",
    listPrice: 2420, price: 700, condition: "fair", writing: "some", course: "微分積分学I",
    description: "角に少し折れがありますが、読むのに問題はありません。",
    listed: [18, "22:05"], photos: ["cover", "inside"],
    cover: { style: "solid", color: "#5c3d2e" },
  }),
  clang: book({
    seller: "taro", title: "プログラミング言語C", author: "B.W.カーニハン／D.M.リッチー（石田晴久 訳）", publisher: "共立出版", isbn: "978432002692",
    listPrice: 3080, price: 900, condition: "good", writing: "none", course: "プログラミング基礎",
    description: "いわゆるK&Rです。授業の参考書でした。",
    listed: [40, "20:30"], photos: ["cover"],
    cover: { style: "frame", color: "#f0ede6", accent: "#2f6fb0", subtitle: "第2版 ANSI規格準拠" },
  }),
  analysis: book({
    seller: "taro", title: "解析入門 I", author: "杉浦光夫", publisher: "東京大学出版会", isbn: "978413062005",
    listPrice: 3080, price: 900, condition: "good", writing: "none", course: "解析学",
    description: "数学科の友人にすすめられて買いましたが、ほとんど使いませんでした。",
    listed: [1, "10:20"], photos: ["cover", "back"],
    cover: { style: "solid", color: "#3b3355", series: "基礎数学 2" },
  }),
  mechanics: book({
    seller: "taro", title: "力学", author: "戸田盛和", publisher: "岩波書店", isbn: "978400029861",
    listPrice: 2750, price: 0, condition: "fair", writing: "lots", course: "力学A",
    description: "書き込みが多いので無料でゆずります。図に色ペンで補足を入れています。",
    listed: [3, "23:10"], photos: ["cover", "inside"],
    cover: { style: "frame", color: "#2f4b3a", subtitle: "物理入門コース 1" },
  }),

  // ---- けんた (経済学部)
  micro: book({
    seller: "kenta", title: "ミクロ経済学の力", author: "神取道宏", publisher: "日本評論社", isbn: "978453555703",
    listPrice: 3520, price: 1050, condition: "good", writing: "some", course: "ミクロ経済学",
    description: "ミクロ経済学の授業で使いました。蛍光ペンの線が少しあります。",
    listed: [26, "21:00"], photos: ["cover", "inside"],
    cover: { style: "solid", color: "#1d5c63" },
  }),
  stats: book({
    seller: "kenta", title: "統計学入門", author: "東京大学教養学部統計学教室 編", publisher: "東京大学出版会", isbn: "978413042065",
    listPrice: 3080, price: 900, condition: "like_new", writing: "none", course: "統計学基礎",
    description: "授業で数回開いただけです。",
    listed: [4, "12:45"], photos: ["cover", "back"],
    cover: { style: "solid", color: "#8a6a1f", series: "基礎統計学 I" },
  }),
  macro: book({
    seller: "kenta", title: "マクロ経済学", author: "齊藤誠・岩本康志・太田聰一・柴田章久", publisher: "有斐閣", isbn: "978464105383",
    listPrice: 4180, price: 1200, condition: "good", writing: "some", course: "マクロ経済学",
    description: "New Liberal Arts Selection のマクロ経済学です。前半に書き込みがあります。",
    listed: [7, "19:15"], photos: ["cover", "inside"],
    cover: { style: "band", color: "#6b2240", series: "New Liberal Arts Selection" },
  }),
  econmath: book({
    seller: "kenta", title: "はじめての経済数学", author: "山田一郎", publisher: "テスト書房", isbn: "978490000012",
    listPrice: 2640, price: 700, condition: "good", writing: "none", course: "経済数学",
    description: "第3版です。経済数学の授業の教科書でした。",
    listed: [2, "12:30"], photos: ["cover"],
    cover: { style: "solid", color: "#35506b", subtitle: "第2版" },
  }),
  boki: book({
    seller: "kenta", title: "スッキリわかる 日商簿記3級", author: "滝澤ななみ", publisher: "TAC出版", isbn: "978481329954",
    listPrice: 1210, price: 0, condition: "fair", writing: "lots", course: "簿記入門",
    description: "書き込み多めです。検定に合格したので無料でどうぞ。",
    listed: [8, "17:50"], photos: ["cover", "inside"],
    cover: { style: "band", color: "#d0573a", accent: "#2b2b2b" },
  }),

  // ---- さくら (文学部)
  psychology: book({
    seller: "sakura", title: "心理学", author: "無藤隆・森敏昭・遠藤由美・玉瀬耕治", publisher: "有斐閣", isbn: "978464105384",
    listPrice: 4180, price: 1200, condition: "good", writing: "none", course: "心理学概論",
    description: "教養の心理学概論で使いました。線引きなし、きれいです。",
    listed: [10, "20:20"], photos: ["cover"],
    cover: { style: "band", color: "#3d6b4f", series: "New Liberal Arts Selection" },
  }),
  sociology: book({
    seller: "sakura", title: "社会学", author: "長谷川公一・浜日出夫・藤村正之・町村敬志", publisher: "有斐閣", isbn: "978464105385",
    listPrice: 4180, price: 1250, condition: "like_new", writing: "none", course: "社会学概論",
    description: "ほぼ新品です。",
    listed: [5, "21:35"], photos: ["cover"],
    cover: { style: "band", color: "#2e4a7d", series: "New Liberal Arts Selection" },
  }),
  writing: book({
    seller: "sakura", title: "アカデミック・ライティング入門", author: "吉田友子", publisher: "慶應義塾大学出版会", isbn: "978476641664",
    listPrice: 1980, price: 500, condition: "like_new", writing: "none", course: "英語ライティング",
    description: "英語論文の書き方の本です。英語ライティングの授業で指定されていました。",
    listed: [3, "13:05"], photos: ["cover"],
    cover: { style: "solid", color: "#7d2e2e", subtitle: "英語論文作成法" },
  }),
  japanese: book({
    seller: "sakura", title: "日本語学概説", author: "加藤みどり", publisher: "テスト書房", isbn: "978490000013",
    listPrice: 2420, price: 0, condition: "fair", writing: "some", course: "日本語学概論",
    description: "表紙にやや傷があります。無料でおゆずりします。",
    listed: [15, "16:40"], photos: ["cover", "inside"],
    cover: { style: "frame", color: "#5b4a3a" },
  }),

  // ---- はなこ / ゆうと
  biology: book({
    seller: "hanako", title: "Essential細胞生物学", author: "B. Alberts ほか（中村桂子・松原謙一 監訳）", publisher: "南江堂", isbn: "978452422674",
    listPrice: 8800, price: 2600, condition: "good", writing: "some", course: "生物学基礎",
    description: "教養の生物学で使いました。図の一部に書き込みがあります。",
    listed: [6, "22:10"], photos: ["cover", "inside"],
    cover: { style: "solid", color: "#0f5f73", subtitle: "原書第5版" },
  }),
  meikai: book({
    seller: "yuto", title: "新・明解C言語 入門編", author: "柴田望洋", publisher: "SBクリエイティブ", isbn: "978481560980",
    listPrice: 2860, price: 850, condition: "like_new", writing: "none", course: "プログラミング演習",
    description: "同じ授業の教科書を先輩からもらったので出品します。新品同様です。",
    listed: { hoursAgo: 5 }, photos: ["cover"],
    cover: { style: "band", color: "#1b6aa5", subtitle: "第2版" },
  }),

  // ---- じろう (サンプル大学): the same title as たろう's, to check that searches stay inside each university
  jiroLinear: book({
    seller: "jiro", title: "線形代数入門", author: "齋藤正彦", publisher: "東京大学出版会", isbn: "978413062001",
    listPrice: 2090, price: 500, condition: "fair", writing: "some", course: "線形代数",
    description: "サンプル大学の出品です（テスト大学の人には表示されません）。",
    listed: [2, "20:00"], photos: ["cover"],
    cover: { style: "solid", color: "#24365f", series: "基礎数学 1" },
  }),
  jiroCalculus: book({
    seller: "jiro", title: "微分積分学", author: "笠原晧司", publisher: "サイエンス社", isbn: "978478190042",
    listPrice: 2420, price: 700, condition: "good", writing: "none", course: "微分積分",
    description: "サンプル大学の出品です。",
    listed: [4, "19:30"], photos: ["cover"],
    cover: { style: "solid", color: "#5c3d2e" },
  }),
};
