"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { PageSpinner } from "@/components/ui/spinner";
import { orNull } from "@/lib/cn";
import { gradeLabel } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { AdminCard, AdminTitle } from "../admin-shell";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data, isPending } = useQuery({
    queryKey: ["admin-users", submitted],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("admin_search_users", { p_query: submitted, p_university_id: orNull<string>(null), p_limit: 100 });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <AdminTitle>ユーザー</AdminTitle>
      <form className="relative mb-4 max-w-md" onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-subtle" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ニックネーム・メール・ユーザーID" className="pl-10" />
      </form>
      <AdminCard>
        {isPending ? (
          <PageSpinner />
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2">ニックネーム</th>
                  <th className="px-2 py-2">メール</th>
                  <th className="px-2 py-2">大学</th>
                  <th className="px-2 py-2">所属</th>
                  <th className="px-2 py-2 text-right">取引</th>
                  <th className="px-2 py-2 text-right">残念</th>
                  <th className="px-4 py-2">登録</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users/${u.id}`} className="font-bold text-primary hover:underline">{u.nickname}</Link>
                      {u.restricted && <Badge tone="danger" className="ml-2">制限中</Badge>}
                      {u.deleted_at && <Badge className="ml-2">退会</Badge>}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted">{u.email ?? "—"}</td>
                    <td className="px-2 py-2.5 text-xs">{u.university_name}</td>
                    <td className="px-2 py-2.5 text-xs text-muted">{[u.faculty, gradeLabel(u.grade)].filter(Boolean).join(" ")}</td>
                    <td className="tabular px-2 py-2.5 text-right">{u.completed_trades}</td>
                    <td className="tabular px-2 py-2.5 text-right">{u.rating_bad}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{timeAgo(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
