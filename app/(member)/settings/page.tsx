"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, FileText, KeyRound, Mail, MessageCircleQuestion, Moon, Palette, Shield, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PasswordInput } from "@/components/auth-inputs";
import { contextKey, useMember } from "@/components/session";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { getSupabase } from "@/lib/supabase/client";

type Theme = "system" | "light" | "dark";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const { ctx, profile, userId, university } = useMember();
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [storedTheme, setStoredTheme] = useLocalStorage("theme");
  const theme: Theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    getPushState().then(setPush);
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: contextKey });

  async function togglePush() {
    setPushBusy(true);
    try {
      const next = push === "on" ? await disablePush() : await enablePush();
      setPush(next);
      if (next === "denied") toast("ブラウザの設定で通知が拒否されています。サイトの設定から許可してください", "error");
    } catch {
      toast("通知の設定を変更できませんでした", "error");
    } finally {
      setPushBusy(false);
    }
  }

  async function toggleEmail(value: boolean) {
    const { error } = await getSupabase().from("user_settings").update({ email_notifications: value }).eq("user_id", userId);
    if (error) toast(errorMessage(error), "error");
    else refresh();
  }

  async function togglePause(value: boolean) {
    const { error } = await getSupabase().from("profiles").update({ listings_paused: value }).eq("id", userId);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast(value ? "おやすみモードにしました。出品は表示されません" : "おやすみモードを解除しました");
    refresh();
    queryClient.invalidateQueries({ queryKey: ["market"] });
  }

  function applyTheme(next: Theme) {
    setStoredTheme(next === "system" ? null : next);
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: "退会しますか？",
      message: (
        <>
          プロフィールと出品はすぐに削除され、元に戻せません。進行中の取引はキャンセルされます。
          <br />
          取引相手の取引履歴と評価は、あなたの名前を伏せた状態で残ります。
        </>
      ),
      confirmLabel: "退会する",
      danger: true,
    });
    if (!ok) return;
    const response = await fetch("/api/account/delete", { method: "POST" });
    if (!response.ok) {
      toast("退会処理に失敗しました。お問い合わせからご連絡ください", "error");
      return;
    }
    await getSupabase().auth.signOut({ scope: "local" });
    // Full reload so no member page renders without a session (see SignOutButton).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/welcome");
  }

  const pushLabel =
    push === "on" ? "オン" : push === "denied" ? "ブラウザで拒否中" : push === "needs-install" ? "ホーム画面に追加が必要" : push === "unsupported" ? "この端末は非対応" : "オフ";

  return (
    <div>
      <PageHeader title="設定" back="/me" />
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-10 pt-5 lg:px-0">
        <Group title="通知">
          <Row icon={<Bell />} label="プッシュ通知（この端末）" hint={push === "needs-install" ? "iPhoneは共有ボタン →「ホーム画面に追加」から開くと使えます" : undefined}>
            {push === "on" || push === "off" ? <Toggle checked={push === "on"} onChange={togglePush} disabled={pushBusy} label="プッシュ通知" /> : <span className="text-xs text-muted">{pushLabel}</span>}
          </Row>
          <Row icon={<Mail />} label="メールでも受け取る" hint="取引のリクエストや日時の確定など">
            <Toggle checked={ctx.settings?.email_notifications ?? true} onChange={toggleEmail} label="メール通知" />
          </Row>
        </Group>

        <Group title="出品">
          <Row icon={<Moon />} label="おやすみモード" hint="長期休みなどで取引できない間、出品をまとめて非表示にします">
            <Toggle checked={profile.listings_paused} onChange={togglePause} label="おやすみモード" />
          </Row>
        </Group>

        <Group title="表示">
          <Row icon={<Palette />} label="テーマ">
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              {(["system", "light", "dark"] as Theme[]).map((t) => (
                <button key={t} type="button" aria-pressed={theme === t} onClick={() => applyTheme(t)} className={cn("rounded-sm px-3 py-1.5", theme === t ? "bg-surface-3 font-semibold" : "text-muted hover:text-fg")}>
                  {t === "system" ? "自動" : t === "light" ? "ライト" : "ダーク"}
                </button>
              ))}
            </div>
          </Row>
        </Group>

        <Group title="アカウント">
          <Row icon={<UserRound />} label={ctx.email} hint={university.name} />
          <LinkRow icon={<UserRound />} href="/me/edit">プロフィールを編集</LinkRow>
          <ButtonRow icon={<KeyRound />} onClick={() => setPasswordOpen(true)}>パスワードを変更</ButtonRow>
        </Group>

        <Group title="サポート">
          <LinkRow icon={<MessageCircleQuestion />} href="/contact">お問い合わせ</LinkRow>
          <LinkRow icon={<Mail />} href="/settings/inquiries">お問い合わせ履歴</LinkRow>
          <LinkRow icon={<FileText />} href="/terms">利用規約</LinkRow>
          <LinkRow icon={<Shield />} href="/privacy">プライバシーポリシー</LinkRow>
        </Group>

        <SignOutButton className="w-full" />
        <button type="button" onClick={deleteAccount} className="mx-auto flex items-center gap-1.5 text-xs text-danger">
          <Trash2 className="size-3.5" />
          退会する
        </button>
      </div>
      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs text-muted">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
    </section>
  );
}

function Row({ icon, label, hint, children }: { icon: ReactNode; label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-muted [&>svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function LinkRow({ icon, href, children }: { icon: ReactNode; href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
      <span className="text-muted [&>svg]:size-5">{icon}</span>
      <span className="flex-1 text-sm">{children}</span>
      <ChevronRight className="size-4.5 text-subtle" />
    </Link>
  );
}

function ButtonRow({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
      <span className="text-muted [&>svg]:size-5">{icon}</span>
      <span className="flex-1 text-sm">{children}</span>
      <ChevronRight className="size-4.5 text-subtle" />
    </button>
  );
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full p-0 transition-colors disabled:opacity-50", checked ? "bg-primary" : "bg-surface-3")}
    >
      <span className={cn("absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useFeedback();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast(/same|different/i.test(error.message) ? "以前と異なるパスワードを設定してください" : /weak|short|least/i.test(error.message) ? "8文字以上の推測されにくいパスワードにしてください" : "変更できませんでした", "error");
      return;
    }
    toast("パスワードを変更しました");
    setPassword("");
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="パスワードを変更" footer={<Button className="w-full" size="lg" disabled={password.length < 8} loading={saving} onClick={save}>変更する</Button>}>
      <Field label="新しいパスワード" htmlFor="new-password" hint="8文字以上">
        <PasswordInput id="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </Sheet>
  );
}
