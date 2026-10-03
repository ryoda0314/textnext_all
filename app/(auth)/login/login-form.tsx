"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/auth-inputs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { getSupabase } from "@/lib/supabase/client";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; unconfirmed?: boolean } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const address = email.trim().toLowerCase();
    const { error: signInError } = await getSupabase().auth.signInWithPassword({ email: address, password });
    if (signInError) {
      setLoading(false);
      if (/not confirmed/i.test(signInError.message)) {
        setError({ message: "メールアドレスの確認が完了していません。確認コードを入力してください。", unconfirmed: true });
      } else if (/invalid login credentials/i.test(signInError.message)) {
        setError({ message: "メールアドレスまたはパスワードが違います" });
      } else if (/rate limit|too many/i.test(signInError.message)) {
        setError({ message: "ログインの試行が多すぎます。しばらく待ってから再度お試しください" });
      } else {
        setError({ message: "ログインできませんでした。時間をおいて再度お試しください" });
      }
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  async function sendCode() {
    const address = email.trim().toLowerCase();
    await getSupabase().auth.resend({ type: "signup", email: address });
    router.push(`/signup?verify=1&email=${encodeURIComponent(address)}`);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-2 text-sm text-muted">大学のメールアドレスでログインしてください。</p>
      </div>
      <Field label="メールアドレス" htmlFor="email">
        <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="パスワード" htmlFor="password">
        <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && (
        <Notice tone="danger">
          {error.message}
          {error.unconfirmed && (
            <button type="button" onClick={sendCode} className="mt-2 block font-bold underline">
              確認コードを送る
            </button>
          )}
        </Notice>
      )}
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
        ログイン
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/reset-password" className="font-bold text-primary">パスワードを忘れた</Link>
        <Link href="/signup" className="font-bold text-primary">新規登録</Link>
      </div>
    </form>
  );
}
