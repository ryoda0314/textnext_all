"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/misc";
import { PageSpinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { INQUIRY_CATEGORIES, type InquiryCategory } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { Row } from "@/lib/types";
import { AdminTitle } from "../admin-shell";

export default function AdminInquiriesPage() {
  const [status, setStatus] = useState<"open" | "answered" | "closed">("open");
  const { data, isPending } = useQuery({
    queryKey: ["admin-inquiries", status],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("inquiries").select("*").eq("status", status).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <AdminTitle>お問い合わせ</AdminTitle>
      <Tabs className="mb-4 max-w-md" value={status} onChange={setStatus} options={[{ value: "open", label: "未対応" }, { value: "answered", label: "回答済み" }, { value: "closed", label: "完了" }]} />
      {isPending ? <PageSpinner /> : (data ?? []).length === 0 ? <EmptyState title="お問い合わせはありません" /> : (
        <ul className="space-y-3">{data!.map((i) => <InquiryCard key={i.id} inquiry={i} />)}</ul>
      )}
    </div>
  );
}

function InquiryCard({ inquiry }: { inquiry: Row<"inquiries"> }) {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [reply, setReply] = useState(inquiry.reply ?? "");
  const [saving, setSaving] = useState(false);

  async function save(status: "answered" | "closed") {
    setSaving(true);
    const { error } = await getSupabase().rpc("admin_reply_inquiry", { p_inquiry_id: inquiry.id, p_reply: reply.trim(), p_status: status });
    setSaving(false);
    if (error) toast(errorMessage(error), "error");
    else {
      toast(inquiry.user_id ? "保存しました（本人にお知らせが届きます）" : "保存しました。ゲストへの返信はメールで送ってください");
      queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>{INQUIRY_CATEGORIES[inquiry.category as InquiryCategory] ?? inquiry.category}</Badge>
        {inquiry.user_id ? (
          <Link href={`/admin/users/${inquiry.user_id}`} className="font-bold text-primary hover:underline">{inquiry.email}</Link>
        ) : (
          <a href={`mailto:${inquiry.email}`} className="font-bold text-primary hover:underline">{inquiry.email}（ゲスト）</a>
        )}
        <span className="ml-auto text-xs text-muted">{timeAgo(inquiry.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{inquiry.body}</p>
      <Textarea className="mt-3" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="回答（会員にはアプリ内で表示されます）" />
      <div className="mt-2 flex gap-2">
        <Button size="sm" loading={saving} disabled={!reply.trim()} onClick={() => save("answered")}>回答する</Button>
        <Button size="sm" variant="secondary" onClick={() => save("closed")}>完了にする</Button>
      </div>
    </li>
  );
}
