"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CalendarCheck2, CalendarClock, Heart, Megaphone, MessageSquareReply, PackageCheck, PartyPopper, ShieldAlert, Star, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { badgeKey } from "@/components/app-shell";
import { LoadMore } from "@/components/load-more";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";

const PAGE = 30;

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  trade_requested: { icon: BellRing, tone: "text-accent" },
  meetup_proposed: { icon: CalendarClock, tone: "text-primary" },
  meetup_confirmed: { icon: CalendarCheck2, tone: "text-success" },
  meetup_reminder: { icon: CalendarCheck2, tone: "text-primary" },
  handover_reported: { icon: PackageCheck, tone: "text-accent" },
  handover_done: { icon: PackageCheck, tone: "text-success" },
  rating_received: { icon: Star, tone: "text-warning" },
  trade_completed: { icon: PartyPopper, tone: "text-success" },
  trade_cancelled: { icon: XCircle, tone: "text-muted" },
  item_available: { icon: Heart, tone: "text-accent" },
  wish_match: { icon: BellRing, tone: "text-primary" },
  inquiry_answered: { icon: MessageSquareReply, tone: "text-primary" },
  moderation: { icon: ShieldAlert, tone: "text-danger" },
  announcement: { icon: Megaphone, tone: "text-primary" },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabase()
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return data as AppNotification[];
    },
    getNextPageParam: (last, pages) => (last.length < PAGE ? undefined : pages.length * PAGE),
  });
  const items = query.data?.pages.flat() ?? [];
  const hasUnread = items.some((n) => !n.read_at);

  // Opening the list marks everything as read (the dots stay until the next visit).
  useEffect(() => {
    if (!hasUnread) return;
    const timer = window.setTimeout(() => {
      getSupabase()
        .rpc("mark_notifications_read", {})
        .then(() => queryClient.invalidateQueries({ queryKey: badgeKey }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hasUnread, queryClient]);

  return (
    <div>
      <PageHeader title="お知らせ" back="/" />
      <div className="px-4 pt-3 lg:px-0">
        {query.isPending ? (
          <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell />} title="お知らせはまだありません" description="取引の連絡や、探している本の入荷などをお知らせします。" />
        ) : (
          <>
            <ul className="-mx-4 divide-y divide-border border-y border-border lg:mx-0 lg:rounded-lg lg:border">
              {items.map((n) => {
                const meta = ICONS[n.type] ?? { icon: Bell, tone: "text-muted" };
                const Icon = meta.icon;
                const body = (
                  <div className={cn("flex gap-3 px-4 py-3.5", !n.read_at && "bg-primary-soft/40")}>
                    <Icon className={cn("mt-0.5 size-5 shrink-0", meta.tone)} strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-subtle">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read_at && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-label="未読" />}
                  </div>
                );
                return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-surface-2">{body}</Link> : body}</li>;
              })}
            </ul>
            <LoadMore hasMore={Boolean(query.hasNextPage)} loading={query.isFetchingNextPage} onLoad={() => query.fetchNextPage()} />
          </>
        )}
      </div>
    </div>
  );
}
