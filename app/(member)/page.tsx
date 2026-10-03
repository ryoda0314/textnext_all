"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CountBadge, Logo, useBadges } from "@/components/app-shell";
import { ItemCard, ItemGrid, ItemGridSkeleton } from "@/components/item-card";
import { LoadMore } from "@/components/load-more";
import { PushPrompt } from "@/components/push-prompt";
import { useMember } from "@/components/session";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextTabs } from "@/components/ui/tabs";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/misc";
import { APP_URL } from "@/lib/env";
import { useMarketFeed, type FeedFilters } from "@/lib/hooks/use-market";
import { shareOrCopy } from "@/lib/share";

type FilterKey = "all" | "faculty" | "free" | `campus:${string}`;

export default function HomePage() {
  const { profile, university } = useMember();
  const { data: badges } = useBadges();
  const { toast } = useFeedback();
  const [filter, setFilter] = useState<FilterKey>("all");

  const filters: FeedFilters = {
    faculty: filter === "faculty" ? profile.faculty : null,
    freeOnly: filter === "free",
    campusId: filter.startsWith("campus:") ? filter.slice(7) : null,
  };
  const filterOptions: { value: FilterKey; label: string }[] = [
    { value: "all", label: "新着" },
    ...(profile.faculty ? [{ value: "faculty" as const, label: profile.faculty }] : []),
    ...(university.campuses.length > 1 ? university.campuses.map((c) => ({ value: `campus:${c.id}` as const, label: c.name })) : []),
    { value: "free", label: "無料" },
  ];
  const feed = useMarketFeed(filters);
  const items = feed.data?.pages.flat() ?? [];
  const universityLabel = university.short_name ?? university.name;

  const invite = async () => {
    const result = await shareOrCopy({
      title: "TextNext",
      text: `${university.name}の教科書フリマ「TextNext」。使わなくなった教科書を学内で受け渡しできます。`,
      url: `${APP_URL}/welcome`,
    });
    if (result === "copied") toast("招待リンクをコピーしました");
  };

  return (
    <div>
      {/* Mobile header */}
      <header className="sticky top-0 z-30 bg-bg/95 pt-safe backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Logo />
          <span className="min-w-0 truncate text-[13px] text-muted">{universityLabel}</span>
          <Link href="/notifications" className="relative ml-auto grid size-10 place-items-center rounded-lg hover:bg-surface-2" aria-label="お知らせ">
            <Bell className="size-[22px]" strokeWidth={1.75} />
            <CountBadge count={badges?.notifications} className="right-1 top-1" />
          </Link>
        </div>
        <div className="px-4 pb-2">
          <Link href="/search" className="flex h-10 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm text-subtle">
            <Search className="size-4" />
            書名・著者・授業名・ISBNで検索
          </Link>
        </div>
      </header>

      <div className="space-y-5 px-4 lg:px-0 lg:pt-8">
        <div className="hidden items-end justify-between lg:flex">
          <h1 className="text-2xl font-bold tracking-tight">{university.name}の教科書</h1>
          <Button variant="outline" size="sm" onClick={invite}>友達に教える</Button>
        </div>

        <TextTabs value={filter} onChange={setFilter} options={filterOptions} className="sticky top-[calc(6.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-bg/95 px-4 backdrop-blur lg:static lg:mx-0 lg:px-0" />

        <PushPrompt />

        {feed.isPending ? (
          <ItemGridSkeleton />
        ) : feed.isError ? (
          <EmptyState title="読み込めませんでした" description="通信環境を確認して、もう一度お試しください。"
            action={<Button variant="secondary" onClick={() => feed.refetch()}>再読み込み</Button>} />
        ) : items.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              title={`${universityLabel}の教科書はまだありません`}
              description="使い終わった教科書を出品して、最初の1冊にしませんか。友達に教えると、探している本が見つかりやすくなります。"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/sell">出品する</ButtonLink>
                  <Button variant="outline" onClick={invite}>友達に教える</Button>
                </div>
              }
            />
          ) : (
            <EmptyState title="条件に合う出品はまだありません" description="ほかの条件で探すか、検索から入荷通知を登録できます。" />
          )
        ) : (
          <>
            <ItemGrid>
              {items.map((item, i) => (
                <ItemCard key={item.id} item={item} priority={i < 4} />
              ))}
            </ItemGrid>
            <LoadMore hasMore={Boolean(feed.hasNextPage)} loading={feed.isFetchingNextPage} onLoad={() => feed.fetchNextPage()} />
          </>
        )}
      </div>
    </div>
  );
}
