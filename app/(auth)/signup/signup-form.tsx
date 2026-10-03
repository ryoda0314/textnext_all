"use client";

import { AlertCircle, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CodeInput, PasswordInput } from "@/components/auth-inputs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { getSupabase } from "@/lib/supabase/client";
import type { SignupVerdict } from "@/lib/types";


function authErrorMessage(message: string) {
  if (/already registered|already been registered/i.test(message)) return "このメールアドレスはすでに登録されています。ログインしてください";
  if (/rate limit|too many/i.test(message)) return "短時間に何度も送信されました。しばらく待ってから再度お試しください";
  if (/password/i.test(message) && /least|short|weak/i.test(message)) return "パスワードは8文字以上で、推測されにくいものにしてください";
  if (/expired|invalid/i.test(message)) return "コードが正しくないか、有効期限が切れています";
  return message || "登録に失敗しました";
}

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const verifyEmail = params.has("verify") ? (params.get("email") ?? "") : "";
  const [email, setEmail] = useState(verifyEmail);

  // The verify step lives in the URL so a reload (or coming back from the mail app) keeps it.
  return verifyEmail ? (
    <VerifyStep email={verifyEmail} onBack={() => router.replace("/signup")} />
  ) : (
    <SignupStep
      email={email}
      setEmail={setEmail}
      onSent={(address) => router.replace(`/signup?verify=1&email=${encodeURIComponent(address)}`)}
    />
  );
}

function SignupStep({ email, setEmail, onSent }: { email: string; setEmail: (v: string) => void; onSent: (email: string) => void }) {
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<{ email: string; verdict: SignupVerdict } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const looksValid = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(normalized);
  const verdict = looksValid && result?.email === normalized ? result.verdict : null;
  const checking = looksValid && result?.email !== normalized;

  useEffect(() => {
    if (!looksValid) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data } = await getSupabase().rpc("check_signup_email", { p_email: normalized });
      if (!cancelled && data) setResult({ email: normalized, verdict: data as unknown as SignupVerdict });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized, looksValid]);

  const canSubmit = Boolean(verdict?.ok) && password.length >= 8 && agreed && !submitting;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const address = email.trim().toLowerCase();
    const { data, error: signUpError } = await getSupabase().auth.signUp({ email: address, password });
    setSubmitting(false);
    if (signUpError) {
      setError(authErrorMessage(signUpError.message));
      return;
    }
    // An existing, confirmed address comes back with no identities (no mail is sent).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("このメールアドレスはすでに登録されています。ログインしてください");
      return;
    }
    onSent(address);
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <h1 className="text-2xl font-bold">新規登録</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          大学から発行されたメールアドレスで登録します。同じ大学の人とだけ取引できます。
        </p>
      </div>

      <Field label="大学のメールアドレス" htmlFor="email" required>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="you@xxx.ac.jp"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={verdict ? !verdict.ok : undefined}
          aria-describedby="email-status"
        />
        <div id="email-status" aria-live="polite">
          <VerdictMessage verdict={verdict} checking={checking} email={email} />
        </div>
      </Field>

      <Field label="パスワード" htmlFor="password" required hint="8文字以上">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          <Link href="/terms" target="_blank" className="font-bold text-primary underline underline-offset-2">利用規約</Link>
          と
          <Link href="/privacy" target="_blank" className="font-bold text-primary underline underline-offset-2">プライバシーポリシー</Link>
          に同意します
        </span>
      </label>

      {error && (
        <Notice tone="danger">
          {error}
          {error.includes("ログイン") && (
            <Link href="/login" className="ml-1 font-bold underline">ログインへ</Link>
          )}
        </Notice>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={submitting}>
        確認コードを送る
      </Button>

      <p className="text-center text-sm text-muted">
        登録済みの方は
        <Link href="/login" className="ml-1 font-bold text-primary">ログイン</Link>
      </p>
    </form>
  );
}

function VerdictMessage({ verdict, checking, email }: { verdict: SignupVerdict | null; checking: boolean; email: string }) {
  const [requestOpen, setRequestOpen] = useState(false);
  if (!verdict) {
    return checking ? <p className="text-xs text-subtle">確認中…</p> : null;
  }
  if (verdict.ok && verdict.kind === "admin") {
    return <StatusLine icon={<CheckCircle2 className="size-4" />} tone="success">管理者アカウントとして登録します</StatusLine>;
  }
  if (verdict.ok) {
    const { university } = verdict;
    return university.is_new ? (
      <StatusLine icon={<Sparkles className="size-4" />} tone="success">
        <b>{university.name}</b> の新しいマーケットを開きます。あなたが最初のメンバーです！
      </StatusLine>
    ) : (
      <StatusLine icon={<CheckCircle2 className="size-4" />} tone="success">
        <b>{university.name}</b> のマーケットに参加します
      </StatusLine>
    );
  }
  if (verdict.reason === "external") {
    return (
      <div className="space-y-2">
        <StatusLine icon={<AlertCircle className="size-4" />} tone="warning">{verdict.university_name}の方は専用サービスをご利用ください。</StatusLine>
        <a href={verdict.external_url} className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          {verdict.external_url}
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <StatusLine icon={<AlertCircle className="size-4" />} tone="danger">{verdict.message}</StatusLine>
      {verdict.reason === "unsupported" && !requestOpen && (
        <button type="button" onClick={() => setRequestOpen(true)} className="text-xs font-bold text-primary underline underline-offset-2">
          大学のメールなのに使えない場合はこちら
        </button>
      )}
      {requestOpen && <UniversityRequest email={email} />}
    </div>
  );
}

function StatusLine({ icon, tone, children }: { icon: React.ReactNode; tone: "success" | "warning" | "danger"; children: React.ReactNode }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger";
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${color}`}>
      <span className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function UniversityRequest({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  if (done) return <Notice tone="success">リクエストを受け付けました。対応したらお知らせします。</Notice>;
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs leading-relaxed text-muted">
        大学名を送っていただければ、運営がメールドメインを確認して利用できるようにします。
      </p>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 〇〇大学" className="h-10" />
        <Button
          size="sm"
          className="h-10 shrink-0"
          loading={sending}
          disabled={name.trim().length < 2}
          onClick={async () => {
            setSending(true);
            await getSupabase().rpc("request_university", { p_email: email, p_university_name: name, p_contact_email: email });
            setSending(false);
            setDone(true);
          }}
        >
          送信
        </Button>
      </div>
    </div>
  );
}

function VerifyStep({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(token: string) {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    const supabase = getSupabase();
    let { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (verifyError) {
      ({ error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: "signup" }));
    }
    if (verifyError) {
      setVerifying(false);
      setCode("");
      setError(authErrorMessage(verifyError.message));
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  }

  async function resend() {
    const { error: resendError } = await getSupabase().auth.resend({ type: "signup", email });
    if (resendError) {
      toast(authErrorMessage(resendError.message), "error");
      return;
    }
    setCooldown(60);
    toast("確認コードを再送しました");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">確認コードを入力</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <b className="text-fg">{email}</b> に6桁のコードを送りました。
        </p>
      </div>

      <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={verifying} />

      {error && <Notice tone="danger">{error}</Notice>}

      <Button size="lg" className="w-full" disabled={code.length !== 6} loading={verifying} onClick={() => verify(code)}>
        確認して次へ
      </Button>

      <div className="space-y-3 rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-muted">
        <p className="font-bold text-fg">メールが届かないとき</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>迷惑メールフォルダや、大学メールの転送設定を確認してください</li>
          <li>届くまで数分かかることがあります</li>
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          <button type="button" onClick={resend} disabled={cooldown > 0} className="font-bold text-primary disabled:text-subtle">
            {cooldown > 0 ? `コードを再送（${cooldown}秒後）` : "コードを再送"}
          </button>
          <button type="button" onClick={onBack} className="font-bold text-primary">
            メールアドレスを変更
          </button>
        </div>
      </div>
    </div>
  );
}
