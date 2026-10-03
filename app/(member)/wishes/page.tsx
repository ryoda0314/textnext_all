"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { Wish } from "@/lib/types";

export default function WishesPage() {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: wishes, isPending } = useQuery({
    queryKey: ["wishes"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("wishes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Wish[];
    },
  });

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (text.length < 2) return;
    const digits = text.replace(/[-\s]/g, "");
    const isbn = /^97[89]\d{10}$/.test(digits) ? digits : null;
    setSaving(true);
    const { error } = await getSupabase().from("wishes").insert(isbn ? { isbn, label: text } : { keyword: text, label: text });
    setSaving(false);
    if (error) {
      toast(/duplicate|unique/i.test(error.message) ? "すでに登録されています" : errorMessage(error), "error");
      return;
    }
    setValue("");
    queryClient.invalidateQueries({ queryKey: ["wishes"] });
    toast("登録しました。出品されたらお知らせします");
  }

  async function remove(id: string) {
    queryClient.setQueryData<Wish[]>(["wishes"], (old) => old?.filter((w) => w.id !== id));
    const { error } = await getSupabase().from("wishes").delete().eq("id", id);
    if (error) {
      toast(errorMessage(error), "error");
      queryClient.invalidateQueries({ queryKey: ["wishes"] });
    }
  }

  return (
    <div>
      <PageHeader title="入荷通知" back="/me" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-10 pt-5 lg:px-0">
        <p className="text-sm leading-relaxed text-muted">
          探している本のキーワードやISBNを登録すると、同じ大学で出品されたときにお知らせします（30件まで）。
        </p>
        <form onSubmit={add} className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="書名・授業名・ISBN" maxLength={40} aria-label="キーワード" />
          <Button type="submit" className="h-12 shrink-0" disabled={value.trim().length < 2} loading={saving}>登録</Button>
        </form>

        {isPending ? (
          <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (wishes ?? []).length === 0 ? (
          <EmptyState icon={<BellRing />} title="登録された入荷通知はありません" description="検索で見つからなかった本も、ここで登録しておけば出品時にお知らせします。" />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {wishes!.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <BellRing className="size-4.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{w.label}</p>
                  <p className="text-[11px] text-muted">
                    {w.isbn ? `ISBN ${w.isbn}` : "キーワード"} ・ {w.last_notified_at ? `最後のお知らせ ${timeAgo(w.last_notified_at)}` : `登録 ${timeAgo(w.created_at)}`}
                  </p>
                </div>
                <Link href={`/search?q=${encodeURIComponent(w.isbn ?? w.keyword ?? w.label)}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="検索する">
                  <Search className="size-4.5" />
                </Link>
                <button type="button" onClick={() => remove(w.id)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="削除">
                  <Trash2 className="size-4.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
