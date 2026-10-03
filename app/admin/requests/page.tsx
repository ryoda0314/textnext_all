"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { CreateUniversitySheet } from "../_components/create-university-sheet";
import { AdminCard, AdminTitle } from "../admin-shell";

/** Sign-up attempts from domains we could not place (e.g. non-.ac.jp university domains). */
export default function AdminRequestsPage() {
  const [creating, setCreating] = useState<string | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("university_requests").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, { domain: string; names: Map<string, number>; count: number; last: string; contacts: Set<string> }>();
    for (const r of data ?? []) {
      const g = map.get(r.email_domain) ?? { domain: r.email_domain, names: new Map(), count: 0, last: r.created_at, contacts: new Set() };
      g.count++;
      g.names.set(r.university_name, (g.names.get(r.university_name) ?? 0) + 1);
      if (r.contact_email) g.contacts.add(r.contact_email);
      map.set(r.email_domain, g);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div>
      <AdminTitle>大学リクエスト</AdminTitle>
      <p className="mb-4 text-sm text-muted">登録できなかったドメインからの「使えるようにしてほしい」リクエストです。大学のドメインと確認できたら大学として追加してください。</p>
      {isPending ? <PageSpinner /> : groups.length === 0 ? <EmptyState title="リクエストはありません" /> : (
        <div className="space-y-3">
          {groups.map((g) => (
            <AdminCard key={g.domain}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono font-bold">{g.domain}</span>
                <span className="text-xs text-muted">{g.count}件 ・ 最新 {timeAgo(g.last)}</span>
                <Button size="sm" className="ml-auto" onClick={() => setCreating(g.domain)}>大学として追加</Button>
              </div>
              <p className="mt-2 text-sm">{[...g.names.entries()].map(([n, c]) => `${n}（${c}）`).join("、")}</p>
              {g.contacts.size > 0 && <p className="mt-1 text-xs text-muted">連絡先: {[...g.contacts].join(", ")}</p>}
            </AdminCard>
          ))}
        </div>
      )}
      {creating && <CreateUniversitySheet open onClose={() => setCreating(null)} initialDomain={creating} />}
    </div>
  );
}
