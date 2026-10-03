"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CodeInput, PasswordInput } from "@/components/auth-inputs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { getSupabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: sendError } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    if (sendError && /rate limit|too many/i.test(sendError.message)) {
      setError("短時間に何度も送信されました。しばらく待ってから再度お試しください");
      return;
    }
    // Same response whether or not the account exists.
    setStep("code");
  }

  async function update(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabase();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "recovery" });
    if (verifyError) {
      setLoading(false);
      setError("コードが正しくないか、有効期限が切れています");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(/same|different/i.test(updateError.message) ? "以前と異なるパスワードを設定してください" : "パスワードを変更できませんでした");
      return;
    }
    toast("パスワードを変更しました");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">パスワードの再設定</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {step === "email"
            ? "登録したメールアドレスに、再設定用の6桁のコードを送ります。"
            : `${email} に届いたコードと、新しいパスワードを入力してください。`}
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-6">
          <Field label="メールアドレス" htmlFor="email">
            <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email.includes("@")}>
            コードを送る
          </Button>
        </form>
      ) : (
        <form onSubmit={update} className="space-y-6">
          <CodeInput value={code} onChange={setCode} />
          <Field label="新しいパスワード" htmlFor="password" hint="8文字以上">
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={code.length !== 6 || password.length < 8}>
            パスワードを変更
          </Button>
          <button type="button" className="text-sm font-bold text-primary" onClick={() => setStep("email")}>
            メールアドレスを入力し直す
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-bold text-primary">ログインに戻る</Link>
      </p>
    </div>
  );
}
