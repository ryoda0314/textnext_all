"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { AdminTitle } from "../admin-shell";

export default function AdminReportsPage() {
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const supabase = getSupabase();
  const { data, isPending } = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("status", status).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const reporterIds = [...new Set((data ?? []).map((r) => r.reporter_id))];
      const { data: people } = await supabase.from("profiles").select("id, nickname").in("id", reporterIds);
      const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.nickname]));
      return (data ?? []).map((r) => ({ ...r, reporter_name: names[r.reporter_id] ?? "?" }));
    },
  });

  async function resolve(id: string, next: "resolved" | "dismissed", note: string) {
    const { error } = await supabase.rpc("admin_resolve_report", { p_report_id: id, p_status: next, p_note: note });
    if (error) toast(errorMessage(error), "error");
    else {
      toast("更新しました");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
  }

  const targetHref = (type: string, id: string) => (type === "item" ? `/admin/items/${id}` : type === "user" ? `/admin/users/${id}` : `/admin/trades/${id}`);

  return (
    <div>
      <AdminTitle>通報</AdminTitle>
      <Tabs className="mb-4 max-w-md" value={status} onChange={setStatus} options={[{ value: "open", label: "未対応" }, { value: "resolved", label: "対応済み" }, { value: "dismissed", label: "却下" }]} />
      {isPending ? (
        <PageSpinner />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="通報はありません" />
      ) : (
        <ul className="space-y-3">
          {data!.map((r) => (
            <ReportCard key={r.id} report={r} href={targetHref(r.target_type, r.target_id)} onResolve={resolve} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportCard({
  report,
  href,
  onResolve,
}: {
  report: { id: string; target_type: string; reason: string; detail: string | null; status: string; admin_note: string | null; created_at: string; reporter_name: string };
  href: string;
  onResolve: (id: string, status: "resolved" | "dismissed", note: string) => void;
}) {
  const [note, setNote] = useState(report.admin_note ?? "");
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="danger">{REPORT_REASONS[report.reason as ReportReason] ?? report.reason}</Badge>
        <Link href={href} className="font-bold text-primary hover:underline">対象の{report.target_type === "item" ? "出品" : report.target_type === "user" ? "ユーザー" : "取引"}を確認</Link>
        <span className="ml-auto text-xs text-muted">通報者: {report.reporter_name} ・ {timeAgo(report.created_at)}</span>
      </div>
      {report.detail && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{report.detail}</p>}
      {report.status === "open" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="対応メモ（内部用）" className="h-9 min-w-56 flex-1" style={{ fontSize: 14 }} />
          <Button size="sm" onClick={() => onResolve(report.id, "resolved", note)}>対応済み</Button>
          <Button size="sm" variant="secondary" onClick={() => onResolve(report.id, "dismissed", note)}>却下</Button>
        </div>
      ) : (
        report.admin_note && <p className="mt-2 text-xs text-muted">メモ: {report.admin_note}</p>
      )}
    </li>
  );
}
