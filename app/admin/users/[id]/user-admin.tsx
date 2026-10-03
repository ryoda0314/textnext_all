"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { PageSpinner } from "@/components/ui/spinner";
import { orNull } from "@/lib/cn";
import { gradeLabel } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { timeAgo, yen } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { cancelLabel } from "@/lib/trade-status";
import type { Profile, Row } from "@/lib/types";
import { AdminCard, AdminTitle } from "../../admin-shell";

type Detail = {
  profile: Profile | null;
  email: string | null;
  last_sign_in_at: string | null;
  university: { id: string; name: string } | null;
  restrictions: Row<"user_restrictions">[];
  items: { id: string; title: string; status: string; price: number; created_at: string }[];
  trades: { id: string; item_title: string; status: string; role: string; cancel_reason: string | null; created_at: string }[];
  reports_against: number;
};

export function UserAdmin({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const supabase = getSupabase();
  const { data, isPending } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: id });
      if (error) throw error;
      return data as unknown as Detail;
    },
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
  async function run(promise: PromiseLike<{ error: unknown }>, success: string) {
    const { error } = await promise;
    if (error) toast(errorMessage(error), "error");
    else {
      toast(success);
      reload();
    }
  }

  if (isPending || !data) return <PageSpinner />;
  const p = data.profile;
  if (!p) return <p className="text-sm text-muted">プロフィールがありません</p>;
  const activeRestriction = data.restrictions.find((r) => !r.lifted_at && (!r.ends_at || new Date(r.ends_at) > new Date()));

  return (
    <div className="space-y-5">
      <AdminTitle>ユーザー詳細</AdminTitle>
      <AdminCard>
        <div className="flex items-center gap-4">
          <Avatar path={p.avatar_path} name={p.nickname} seed={p.id} size={56} />
          <div className="min-w-0">
            <p className="text-lg font-bold">{p.nickname} {p.deleted_at && <Badge>退会</Badge>} {activeRestriction && <Badge tone="danger">{activeRestriction.kind}</Badge>}</p>
            <p className="text-sm text-muted">{data.email} ・ {data.university?.name}</p>
            <p className="text-xs text-muted">{[p.faculty, p.department, gradeLabel(p.grade)].filter(Boolean).join(" ・ ")} ・ 登録 {timeAgo(p.created_at)} ・ 最終ログイン {data.last_sign_in_at ? timeAgo(data.last_sign_in_at) : "—"}</p>
            <p className="mt-1 text-xs">取引 {p.completed_trades} ・ 良い {p.rating_good}・普通 {p.rating_normal}・残念 {p.rating_bad} ・ 通報された回数 {data.reports_against}</p>
          </div>
        </div>
      </AdminCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <RestrictForm
          active={activeRestriction ?? null}
          onRestrict={async (kind, reason, endsAt) => {
            if (!(await confirm({ title: kind === "banned" ? "アカウントを停止（BAN）しますか？" : "利用を制限しますか？", message: "進行中の取引はキャンセルされ、出品は非公開になります。", danger: true, confirmLabel: "実行" }))) return;
            run(supabase.rpc("admin_restrict_user", { p_user_id: id, p_kind: kind, p_reason: reason, p_ends_at: orNull(endsAt) }), "制限しました");
          }}
          onLift={() => activeRestriction && run(supabase.rpc("admin_lift_restriction", { p_restriction_id: activeRestriction.id }), "制限を解除しました")}
        />
        <NotifyForm onSend={(title, body) => run(supabase.rpc("admin_notify_user", { p_user_id: id, p_title: title, p_body: body, p_link: orNull<string>(null) }), "お知らせを送りました")} />
      </div>

      <AdminCard title={`出品（${data.items.length}）`}>
        <ul className="divide-y divide-border text-sm">
          {data.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/admin/items/${item.id}`} className="font-bold text-primary hover:underline">{item.title}</Link>
              <Badge>{item.status}</Badge>
              <span className="tabular text-xs text-muted">{yen(item.price)}</span>
              {item.status !== "removed" && item.status !== "reserved" && (
                <Button size="sm" variant="danger-soft" className="ml-auto h-8" onClick={async () => {
                  if (await confirm({ title: "この出品を非公開にしますか？", message: "出品者にお知らせが届きます。", danger: true, confirmLabel: "非公開にする" })) {
                    run(supabase.rpc("admin_set_item_status", { p_item_id: item.id, p_status: "removed", p_reason: "規約違反のため" }), "非公開にしました");
                  }
                }}>非公開</Button>
              )}
              {item.status === "removed" && (
                <Button size="sm" variant="secondary" className="ml-auto h-8" onClick={() => run(supabase.rpc("admin_set_item_status", { p_item_id: item.id, p_status: "hidden", p_reason: orNull<string>(null) }), "出品者の非公開状態に戻しました")}>復元</Button>
              )}
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard title={`取引（${data.trades.length}）`}>
        <ul className="divide-y divide-border text-sm">
          {data.trades.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/admin/trades/${t.id}`} className="font-bold text-primary hover:underline">{t.item_title}</Link>
              <Badge>{t.role === "buyer" ? "購入" : "出品"}</Badge>
              <Badge tone={t.status === "completed" ? "success" : t.status === "cancelled" ? "neutral" : "primary"}>{t.status === "cancelled" ? cancelLabel(t.cancel_reason) : t.status}</Badge>
              <span className="ml-auto text-xs text-muted">{timeAgo(t.created_at)}</span>
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard title="制限の履歴">
        {data.restrictions.length === 0 ? <p className="text-sm text-muted">なし</p> : (
          <ul className="space-y-2 text-sm">
            {data.restrictions.map((r) => (
              <li key={r.id}>
                <Badge tone={r.lifted_at ? "neutral" : "danger"}>{r.kind}</Badge> {r.reason}
                <span className="ml-2 text-xs text-muted">{timeAgo(r.created_at)}{r.ends_at && ` 〜 ${new Date(r.ends_at).toLocaleDateString("ja-JP")}`}{r.lifted_at && "（解除済み）"}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

function RestrictForm({ active, onRestrict, onLift }: { active: Row<"user_restrictions"> | null; onRestrict: (kind: string, reason: string, endsAt: string | null) => void; onLift: () => void }) {
  const [kind, setKind] = useState("suspended");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  if (active) {
    return (
      <AdminCard title="利用制限">
        <p className="text-sm"><Badge tone="danger">{active.kind}</Badge> {active.reason}</p>
        <Button variant="secondary" className="mt-3" onClick={onLift}>制限を解除</Button>
      </AdminCard>
    );
  }
  return (
    <AdminCard title="利用制限">
      <div className="space-y-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10">
          <option value="suspended">一時的な利用制限</option>
          <option value="banned">アカウント停止（再登録も不可）</option>
        </Select>
        {kind === "suspended" && (
          <Field label="期間（日）" htmlFor="days"><Input id="days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} className="h-10 w-24" /></Field>
        )}
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="理由（本人に表示されます）" />
        <Button variant="danger" disabled={!reason.trim()} onClick={() => onRestrict(kind, reason.trim(), kind === "suspended" && Number(days) > 0 ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null)}>
          制限する
        </Button>
      </div>
    </AdminCard>
  );
}

function NotifyForm({ onSend }: { onSend: (title: string, body: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <AdminCard title="個別にお知らせを送る">
      <div className="space-y-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" className="h-10" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="本文" />
        <Button disabled={!title.trim()} onClick={() => { onSend(title.trim(), body.trim()); setTitle(""); setBody(""); }}>送信</Button>
      </div>
    </AdminCard>
  );
}
