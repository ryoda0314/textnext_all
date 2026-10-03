import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "TextNext — その教科書、次の人へ。",
  description: "大学のメールアドレスで登録した学生同士で、教科書を学内で売り買いするフリマ。価格は定価の3割まで、受け渡しはキャンパスで。",
};

const SAMPLE_BOOKS = [
  { title: "線形代数入門", author: "齋藤 正彦", color: "#22335c", price: "¥1,040" },
  { title: "ミクロ経済学", author: "神取 道宏", color: "#2f5d50", price: "¥900", reserved: true },
  { title: "有機化学", author: "ボルハルト・ショアー", color: "#6b2d2d", price: "¥2,280" },
  { title: "統計学入門", author: "東京大学教養学部統計学教室", color: "#8a6a1f", price: "¥0" },
];

const STEPS = [
  { title: "出品する", body: "裏表紙のバーコードを読み取ると、書名と定価が入ります。写真を撮ったら出品完了です。" },
  { title: "リクエストが届く", body: "買いたい人が、都合のいい日時と受け渡し場所の候補を添えて申し込みます。" },
  { title: "キャンパスで会う", body: "候補から1つ選べば待ち合わせが決まります。会ったら出品者の画面のQRを読み取って完了。" },
  { title: "お互いを評価する", body: "評価は両方そろってから公開されます。代金は会ったときに直接やりとりします。" },
];

export default async function WelcomePage() {
  const supabase = await createSupabaseServer();
  const { data: directory } = await supabase.rpc("public_university_directory");

  return (
    <div>
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="text-sm text-muted">大学のメールアドレスで登録する、学内だけのフリマ</p>
          <h1 className="mt-4 text-[2.4rem] font-bold leading-[1.2] tracking-tight sm:text-6xl">
            その教科書、
            <br />
            次の人へ。
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            使い終わった教科書を、同じ大学の後輩に。TextNext は、大学のメールアドレスで登録した学生同士で教科書を売り買いするフリマです。
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link href="/signup" className={buttonClass("primary", "lg", "px-6")}>大学のメールで登録</Link>
            <Link href="/login" className="text-sm font-semibold underline underline-offset-4">ログイン</Link>
          </div>
        </div>

        {/* A plain rendering of the market itself, not an illustration. */}
        <div className="rounded-lg border border-border p-4 sm:p-5" aria-hidden>
          <div className="flex gap-5 border-b border-border text-sm">
            <span className="-mb-px border-b-2 border-primary pb-2 font-semibold">新着</span>
            <span className="pb-2 text-muted">工学部</span>
            <span className="pb-2 text-muted">無料</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {SAMPLE_BOOKS.map((book, i) => (
              <div key={book.title} className={i === 3 ? "hidden sm:block" : undefined}>
                <div className="relative flex aspect-[3/4] flex-col justify-between rounded-md p-2 text-white" style={{ background: book.color }}>
                  <div>
                    <p className="phrase text-[12px] font-bold leading-tight">{book.title}</p>
                    <p className="phrase mt-1 line-clamp-2 text-[9px] leading-tight opacity-75">{book.author}</p>
                  </div>
                  <div className="h-px bg-white/35" />
                  {book.reserved && <span className="absolute bottom-3 left-0 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#15171c]">取引中</span>}
                </div>
                <p className={`tabular mt-2 text-sm font-bold ${book.price === "¥0" ? "text-accent" : ""}`}>{book.price === "¥0" ? "無料" : book.price}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{book.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">値段は、定価の3割まで。</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              価格交渉はありません。上限より安くするのも、無料でゆずるのも自由です。現金でもキャッシュレスでも、払うのは会ったときに直接です。
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-l-[3px] border-primary pl-6">
            <div>
              <p className="text-sm text-muted">定価</p>
              <p className="tabular text-3xl font-bold text-muted line-through decoration-1">3,490円</p>
            </div>
            <div>
              <p className="text-sm text-muted">TextNext での上限</p>
              <p className="tabular text-5xl font-bold text-primary">1,040円</p>
            </div>
            <p className="w-full text-xs text-subtle">定価 × 30% を10円未満切り捨て</p>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight">受け渡しは、キャンパスで。</h2>
          <ol className="mt-8 divide-y divide-border border-y border-border">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid gap-1 py-5 sm:grid-cols-[3rem_12rem_1fr] sm:gap-4">
                <span className="tabular text-sm font-semibold text-primary">{String(i + 1).padStart(2, "0")}</span>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight">同じ大学の人とだけ。</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            登録したメールアドレスのドメインで大学を判定します。ほかの大学の人には、あなたの出品もプロフィールも見えません。大学から発行された「〜.ac.jp」のアドレスなら、一覧にない大学でも登録できます。
          </p>
          {directory && directory.length > 0 && (
            <ul className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {directory.map((u) => (
                <li key={u.name} className="flex items-baseline justify-between border-b border-border py-3">
                  <span>{u.name}</span>
                  <span className="tabular text-xs text-muted">出品 {u.active_items}冊</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm text-muted">
            東京科学大学の方は <a className="underline underline-offset-2" href="https://textnext.jp">textnext.jp</a> をご利用ください。
          </p>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">登録は1分で終わります。</h2>
            <p className="mt-2 text-sm text-muted">大学のメールアドレスとパスワードを入れて、届いた6桁のコードを入力するだけです。</p>
          </div>
          <Link href="/signup" className={buttonClass("primary", "lg", "px-6")}>大学のメールで登録</Link>
        </div>
      </section>
    </div>
  );
}
