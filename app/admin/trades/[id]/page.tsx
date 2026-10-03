"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { useFeedback } from "@/components/ui/feedback";
import { PageSpinner } from "@/components/ui/spinner";
import { orNull } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { yen } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { cancelLabel } from "@/lib/trade-status";
import { AdminCard, AdminTitle } from "../../admin-shell";

export default function AdminTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const supabase = getSupabase();

  const { data, isPending } = useQuery({
    queryKey: ["admin-trade", id],
    queryFn: async () => {
      const [{ data: trade }, { data: messages }] = await Promise.all([
        supabase.from("trades").select("*").eq("id", id).maybeSingle(),
        supabase.from("messages").select("*").eq("trade_id", id).order("created_at"),
      ]);
      if (!trade) return null;
      const { data: people } = await supabase.from("profiles").select("id, nickname").in("id", [trade.buyer_id, trade.seller_id]);
      return { trade, messages: messages ?? [], names: Object.fromEntries((people ?? []).map((p) => [p.id, p.nickname])) };
    },
  });

  if (isPending) return <PageSpinner />;
  if (!data) return <p className="text-sm text-muted">見つかりません</p>;
  const { trade, messages, names } = data;
  const open = ["negotiating", "scheduled"].includes(trade.status);

  async function act(kind: "cancel" | "handover") {
    const ok = await confirm({
      title: kind === "cancel" ? "運営として取引をキャンセルしますか？" : "受け渡し済みとして扱いますか？",
      message: "双方にお知らせが届きます。",
      danger: kind === "cancel",
      confirmLabel: "実行",
    });
    if (!ok) return;
    const { error } = kind === "cancel"
      ? await supabase.rpc("admin_cancel_trade", { p_trade_id: id, p_note: orNull<string>(null) })
      : await supabase.rpc("admin_mark_handed_over", { p_trade_id: id });
    if (error) toast(errorMessage(error), "error");
    else {
      toast("更新しました");
      queryClient.invalidateQueries({ queryKey: ["admin-trade", id] });
    }
  }

  return (
    <div className="space-y-5">
      <AdminTitle>取引の確認</AdminTitle>
      <AdminCard>
        <p className="text-lg font-bold">{trade.item_title} <span className="tabular text-sm font-bold text-muted">{yen(trade.price)}</span></p>
        <p className="mt-1 text-sm">
          出品者 <Link className="font-bold text-primary" href={`/admin/users/${trade.seller_id}`}>{names[trade.seller_id]}</Link>
          {" ・ "}購入者 <Link className="font-bold text-primary" href={`/admin/users/${trade.buyer_id}`}>{names[trade.buyer_id]}</Link>
        </p>
        <p className="mt-2"><Badge>{trade.status === "cancelled" ? cancelLabel(trade.cancel_reason) : trade.status}</Badge></p>
        {trade.meetup_date && <p className="mt-2 text-sm">受け渡し: {trade.meetup_date} {trade.meetup_time ?? trade.meetup_slot} / {trade.meetup_place}</p>}
        {open && (
          <div className="mt-4 flex gap-2">
            <Button variant="danger" size="sm" onClick={() => act("cancel")}>キャンセルする</Button>
            <Button variant="secondary" size="sm" onClick={() => act("handover")}>受け渡し済みにする</Button>
          </div>
        )}
      </AdminCard>
      <AdminCard title="メッセージ">
        <ul className="space-y-2 text-sm">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-[11px] text-muted">{m.sender_id ? names[m.sender_id] ?? "?" : "システム"} ・ {new Date(m.created_at).toLocaleString("ja-JP")}</p>
              <p className="whitespace-pre-wrap">{m.kind === "image" ? `［画像］${m.image_path}` : m.body}</p>
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
