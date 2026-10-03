"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageCircleQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { INQUIRY_CATEGORIES, type InquiryCategory } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

export default function InquiriesPage() {
  const { data, isPending } = useQuery({
    queryKey: ["my-inquiries"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("inquiries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="お問い合わせ履歴" back="/settings" />
      <div className="mx-auto max-w-2xl space-y-3 px-4 pb-10 pt-5 lg:px-0">
        {isPending ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24" />)
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon={<MessageCircleQuestion />} title="お問い合わせはありません" action={<ButtonLink href="/contact" variant="secondary">お問い合わせする</ButtonLink>} />
        ) : (
          data!.map((inquiry) => (
            <article key={inquiry.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <Badge>{INQUIRY_CATEGORIES[inquiry.category as InquiryCategory] ?? inquiry.category}</Badge>
                <Badge tone={inquiry.status === "answered" ? "success" : inquiry.status === "closed" ? "neutral" : "warning"}>
                  {inquiry.status === "answered" ? "回答済み" : inquiry.status === "closed" ? "完了" : "確認中"}
                </Badge>
                <span className="ml-auto text-[11px] text-subtle">{timeAgo(inquiry.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{inquiry.body}</p>
              {inquiry.reply && (
                <div className="mt-3 rounded-xl bg-primary-soft p-3">
                  <p className="text-xs font-bold text-primary-soft-fg">運営からの回答</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{inquiry.reply}</p>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
