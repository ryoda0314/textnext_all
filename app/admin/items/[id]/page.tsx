"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { useFeedback } from "@/components/ui/feedback";
import { PageSpinner } from "@/components/ui/spinner";
import { orNull } from "@/lib/cn";
import { CONDITIONS, type Condition } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { timeAgo, yen } from "@/lib/format";
import { itemImageUrl } from "@/lib/images";
import { fetchItem } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";
import { itemImages } from "@/lib/types";
import { AdminCard, AdminTitle } from "../../admin-shell";

export default function AdminItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const { data: item, isPending } = useQuery({ queryKey: ["admin-item", id], queryFn: () => fetchItem(id) });

  if (isPending) return <PageSpinner />;
  if (!item) return <p className="text-sm text-muted">見つかりません</p>;

  async function setStatus(status: "removed" | "hidden") {
    if (status === "removed" && !(await confirm({ title: "非公開（運営削除）にしますか？", message: "出品者にお知らせが届きます。", danger: true, confirmLabel: "非公開にする" }))) return;
    const { error } = await getSupabase().rpc("admin_set_item_status", { p_item_id: id, p_status: status, p_reason: orNull(status === "removed" ? "規約違反のため" : null) });
    if (error) toast(errorMessage(error), "error");
    else {
      toast("更新しました");
      queryClient.invalidateQueries({ queryKey: ["admin-item", id] });
    }
  }

  return (
    <div className="space-y-5">
      <AdminTitle>出品の確認</AdminTitle>
      <AdminCard>
        <div className="flex flex-wrap gap-2">
          {itemImages(item.images).map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={img.path} href={itemImageUrl(img, "full") ?? ""} target="_blank" rel="noreferrer"><img src={itemImageUrl(img, "thumb") ?? ""} alt="" className="h-40 rounded-xl bg-surface-2 object-cover" /></a>
          ))}
        </div>
        <h2 className="mt-4 text-lg font-bold">{item.title}</h2>
        <p className="text-sm text-muted">{[item.author, item.publisher, item.isbn].filter(Boolean).join(" / ")}</p>
        <p className="mt-2 text-sm">
          <Badge>{item.status}</Badge> {yen(item.price)}（定価 {yen(item.list_price)}）・{CONDITIONS[item.condition as Condition]?.label} ・ {timeAgo(item.created_at)}
        </p>
        {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>}
        {item.seller && <p className="mt-3 text-sm">出品者: <Link href={`/admin/users/${item.seller.id}`} className="font-bold text-primary hover:underline">{item.seller.nickname}</Link></p>}
        <div className="mt-4 flex gap-2">
          {item.status !== "removed" && item.status !== "reserved" && <Button variant="danger" onClick={() => setStatus("removed")}>非公開にする</Button>}
          {item.status === "removed" && <Button variant="secondary" onClick={() => setStatus("hidden")}>復元（出品者の非公開に戻す）</Button>}
          {item.status === "reserved" && <p className="text-xs text-muted">取引中のため、先に取引をキャンセルしてください。</p>}
        </div>
      </AdminCard>
    </div>
  );
}
