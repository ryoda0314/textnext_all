"use client";

import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ItemCard, ItemGrid, ItemGridSkeleton } from "@/components/item-card";
import { RatingSummary } from "@/components/rating-summary";
import { useMember } from "@/components/session";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { gradeLabel } from "@/lib/constants";
import { getSupabase } from "@/lib/supabase/client";
import type { CardItem } from "@/components/item-card";

type Tab = "selling" | "hidden" | "sold" | "liked";

export default function MyPage() {
  const { profile, university, userId } = useMember();
  const [tab, setTab] = useState<Tab>("selling");

  const myItems = useQuery({
    queryKey: ["my-items"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("items")
        .select("id, title, price, images, status, condition, favorite_count, course_name")
        .eq("seller_id", userId)
        .neq("status", "removed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const liked = useQuery({
    queryKey: ["favorites"],
    enabled: tab === "liked",
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("favorites")
        .select("created_at, item:items(id, title, price, images, status, condition, favorite_count, course_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((f) => f.item as unknown as CardItem | null).filter((i): i is CardItem => Boolean(i));
    },
  });

  const items = myItems.data ?? [];
  const groups: Record<Exclude<Tab, "liked">, CardItem[]> = {
    selling: items.filter((i) => i.status === "active" || i.status === "reserved"),
    hidden: items.filter((i) => i.status === "hidden"),
    sold: items.filter((i) => i.status === "sold"),
  };
  const list = tab === "liked" ? (liked.data ?? []) : groups[tab];
  const loading = tab === "liked" ? liked.isPending : myItems.isPending;

  return (
    <div className="space-y-6 px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] lg:px-0 lg:pt-10">
      <section className="flex items-start gap-4">
        <Avatar path={profile.avatar_path} name={profile.nickname} seed={profile.id} size={60} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold leading-tight">{profile.nickname}</p>
          <p className="mt-1 truncate text-xs text-muted">{university.name}</p>
          <p className="truncate text-xs text-muted">{[profile.faculty, profile.department, gradeLabel(profile.grade)].filter(Boolean).join("・")}</p>
          <RatingSummary className="mt-2 block" good={profile.rating_good} normal={profile.rating_normal} bad={profile.rating_bad} completed={profile.completed_trades} />
        </div>
        <Link href="/me/edit" className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2">
          編集
        </Link>
      </section>
      {profile.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{profile.bio}</p>}

      {profile.listings_paused && (
        <Notice tone="warning">
          おやすみモード中です。あなたの出品はほかの人に表示されません。
          <Link href="/settings" className="ml-1 underline">設定を変える</Link>
        </Notice>
      )}

      <nav className="-mx-4 divide-y divide-border border-y border-border lg:mx-0 lg:rounded-lg lg:border" aria-label="マイページのメニュー">
        <MenuRow href="/trades" label="取引" hint="進行中・終了した取引" />
        <MenuRow href="/wishes" label="入荷通知" hint="探している本が出品されたらお知らせ" />
        <MenuRow href="/settings" label="設定" hint="通知・おやすみモード・アカウント" />
      </nav>

      <section className="space-y-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "selling", label: "出品中", count: groups.selling.length },
            { value: "hidden", label: "非公開" },
            { value: "sold", label: "売却済み" },
            { value: "liked", label: "いいね" },
          ]}
        />
        {loading ? (
          <ItemGridSkeleton count={4} />
        ) : list.length === 0 ? (
          tab === "liked" ? (
            <EmptyState icon={<Heart />} title="いいねした出品はありません" description="気になる教科書にいいねすると、ここにまとまります。取引中の本は、再び買えるようになったらお知らせします。" />
          ) : (
            <EmptyState
              icon={<Camera />}
              title={tab === "selling" ? "出品中の教科書はありません" : tab === "hidden" ? "非公開の出品はありません" : "売却済みの教科書はありません"}
              action={tab === "selling" && <ButtonLink href="/sell" variant="accent">出品する</ButtonLink>}
            />
          )
        ) : (
          <ItemGrid>
            {list.map((item) => <ItemCard key={item.id} item={item} />)}
          </ItemGrid>
        )}
      </section>

    </div>
  );
}

function MenuRow({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight className="size-4 text-subtle" />
    </Link>
  );
}
