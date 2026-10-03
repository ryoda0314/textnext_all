"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { orNull } from "@/lib/cn";
import { INQUIRY_CATEGORIES, type InquiryCategory } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export default function ContactPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [category, setCategory] = useState<InquiryCategory | "">("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const valid = category !== "" && body.trim().length >= 10 && (signedIn || /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim()));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSending(true);
    setError(null);
    const { error: rpcError } = await getSupabase().rpc("submit_inquiry", {
      p_category: category,
      p_body: body.trim(),
      p_email: orNull(signedIn ? null : email.trim()),
    });
    setSending(false);
    if (rpcError) {
      setError(errorMessage(rpcError));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h1 className="mt-4 text-xl font-bold">送信しました</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          内容を確認して、{signedIn ? "アプリのお知らせ（お問い合わせ履歴）" : "入力いただいたメールアドレス"}にご連絡します。
        </p>
        <ButtonLink href={signedIn ? "/settings/inquiries" : "/welcome"} variant="secondary" className="mt-6">
          {signedIn ? "お問い合わせ履歴へ" : "トップへ"}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-bold">お問い合わせ</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          取引中の相手とのトラブルは、取引画面のメニューにある「運営に通報する」からの連絡が確実です。
        </p>
      </div>
      <Field label="種類" htmlFor="category" required>
        <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as InquiryCategory)}>
          <option value="" disabled>選択してください</option>
          {(Object.keys(INQUIRY_CATEGORIES) as InquiryCategory[]).map((c) => <option key={c} value={c}>{INQUIRY_CATEGORIES[c]}</option>)}
        </Select>
      </Field>
      {signedIn === false && (
        <Field label="返信先のメールアドレス" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      )}
      <Field label="内容" htmlFor="body" required counter={{ value: body.length, max: 2000 }} hint="10文字以上。氏名・学籍番号などの個人情報は書かないでください">
        <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={2000} />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={!valid} loading={sending}>送信する</Button>
      <p className="text-center text-xs text-muted">
        <Link href="/privacy" className="underline">プライバシーポリシー</Link>に沿って取り扱います
      </p>
    </form>
  );
}
