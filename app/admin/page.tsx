"use client";

import Link from "next/link";
import { PageSpinner } from "@/components/ui/spinner";
import { AdminCard, AdminTitle } from "./admin-shell";
import { UniversityTable, useAdminDashboard } from "./_components/dashboard";

const TOTALS: { key: string; label: string; href?: string; alert?: boolean }[] = [
  { key: "universities", label: "稼働中の大学", href: "/admin/universities" },
  { key: "members", label: "会員", href: "/admin/users" },
  { key: "active_items", label: "出品中" },
  { key: "open_trades", label: "進行中の取引" },
  { key: "completed_trades", label: "完了した取引" },
  { key: "open_reports", label: "未対応の通報", href: "/admin/reports", alert: true },
  { key: "open_inquiries", label: "未対応のお問い合わせ", href: "/admin/inquiries", alert: true },
  { key: "pending_names", label: "大学名の確認待ち", href: "/admin/universities", alert: true },
  { key: "university_requests", label: "大学リクエスト（30日）", href: "/admin/requests" },
];

export default function AdminDashboardPage() {
  const { data, isPending } = useAdminDashboard();
  if (isPending || !data) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <AdminTitle>ダッシュボード</AdminTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {TOTALS.map((t) => {
          const value = data.totals[t.key] ?? 0;
          const body = (
            <div className={`rounded-2xl border p-4 ${t.alert && value > 0 ? "border-accent/40 bg-accent/8" : "border-border bg-surface"}`}>
              <p className="text-xs font-bold text-muted">{t.label}</p>
              <p className="tabular mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
            </div>
          );
          return t.href ? <Link key={t.key} href={t.href} className="block hover:opacity-90">{body}</Link> : <div key={t.key}>{body}</div>;
        })}
      </div>
      <AdminCard title="大学別">
        <UniversityTable rows={data.universities} />
      </AdminCard>
    </div>
  );
}
