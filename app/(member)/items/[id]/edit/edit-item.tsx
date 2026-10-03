"use client";

import { useQuery } from "@tanstack/react-query";
import { ItemForm } from "@/components/sell/item-form";
import { useMember } from "@/components/session";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { fetchItem } from "@/lib/queries";

export function EditItem({ id }: { id: string }) {
  const { userId } = useMember();
  const { data: item, isPending } = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id) });

  return (
    <>
      <PageHeader title="出品を編集" back={`/items/${id}`} />
      {isPending ? (
        <PageSpinner />
      ) : !item || item.seller_id !== userId ? (
        <EmptyState title="編集できません" description="この出品は見つからないか、あなたの出品ではありません。" action={<ButtonLink href="/" variant="secondary">ホームへ</ButtonLink>} />
      ) : item.status !== "active" && item.status !== "hidden" ? (
        <EmptyState title="取引中・売却済みの出品は編集できません" action={<ButtonLink href={`/items/${id}`} variant="secondary">出品に戻る</ButtonLink>} />
      ) : (
        <ItemForm item={item} />
      )}
    </>
  );
}
