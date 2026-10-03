"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { AdminCard, AdminTitle } from "../admin-shell";
import { CreateUniversitySheet } from "../_components/create-university-sheet";
import { UniversityTable, useAdminDashboard } from "../_components/dashboard";

export default function AdminUniversitiesPage() {
  const { data, isPending } = useAdminDashboard();
  const [creating, setCreating] = useState(false);
  if (isPending || !data) return <PageSpinner />;
  const pending = data.universities.filter((u) => !u.name_verified && u.status === "active");

  return (
    <div className="space-y-6">
      <AdminTitle action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>大学を追加</Button>}>大学</AdminTitle>
      {pending.length > 0 && (
        <AdminCard title={`名前の確認待ち（${pending.length}）`}>
          <p className="mb-3 text-xs text-muted">*.ac.jp のメールで自動作成されたグループです。正式名称を確認して設定してください。</p>
          <UniversityTable rows={pending} />
        </AdminCard>
      )}
      <AdminCard title="すべての大学">
        <UniversityTable rows={data.universities} />
      </AdminCard>
      <CreateUniversitySheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
