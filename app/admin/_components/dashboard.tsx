"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/chip";
import { getSupabase } from "@/lib/supabase/client";

export type AdminUniversityRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  name_verified: boolean;
  is_auto_created: boolean;
  created_at: string;
  members: number;
  new_members_7d: number;
  active_items: number;
  completed_trades: number;
  domains: string[] | null;
};

export type AdminDashboard = {
  totals: Record<string, number>;
  universities: AdminUniversityRow[];
};

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("admin_dashboard");
      if (error) throw error;
      return data as unknown as AdminDashboard;
    },
  });
}

export function UniversityTable({ rows }: { rows: AdminUniversityRow[] }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-2 font-bold">大学</th>
            <th className="px-2 py-2 font-bold">状態</th>
            <th className="px-2 py-2 text-right font-bold">会員</th>
            <th className="px-2 py-2 text-right font-bold">+7日</th>
            <th className="px-2 py-2 text-right font-bold">出品中</th>
            <th className="px-2 py-2 text-right font-bold">取引完了</th>
            <th className="px-4 py-2 font-bold">ドメイン</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-2">
              <td className="px-4 py-2.5">
                <Link href={`/admin/universities/${u.id}`} className="font-bold text-primary hover:underline">{u.name}</Link>
                {!u.name_verified && <Badge tone="warning" className="ml-2">名前未確認</Badge>}
              </td>
              <td className="px-2 py-2.5">
                <Badge tone={u.status === "active" ? "success" : u.status === "external" ? "primary" : "neutral"}>{u.status}</Badge>
              </td>
              <td className="tabular px-2 py-2.5 text-right">{u.members}</td>
              <td className="tabular px-2 py-2.5 text-right">{u.new_members_7d}</td>
              <td className="tabular px-2 py-2.5 text-right">{u.active_items}</td>
              <td className="tabular px-2 py-2.5 text-right">{u.completed_trades}</td>
              <td className="max-w-56 truncate px-4 py-2.5 text-xs text-muted">{(u.domains ?? []).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
