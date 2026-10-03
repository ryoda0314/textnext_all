"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMember } from "@/components/session";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { timeAgo, yen } from "@/lib/format";
import { itemThumbUrl } from "@/lib/images";
import { getSupabase } from "@/lib/supabase/client";
import { NEEDS_ME, phaseLabel, tradePhase } from "@/lib/trade-status";
import type { MyTrade } from "@/lib/types";

export default function TradesPage() {
  const { userId, university } = useMember();
  const [tab, setTab] = useState<"open" | "closed">("open");

  const { data: trades, isPending } = useQuery({
    queryKey: ["my-trades"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("my_trades").select("*").order("last_message_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as MyTrade[];
    },
  });

  const { open, closed } = useMemo(() => {
    const withPhase = (trades ?? []).map((t) => ({ trade: t, phase: tradePhase(t, userId, Boolean(t.i_rated)) }));
    const openList = withPhase
      .filter(({ trade }) => ["negotiating", "scheduled", "handed_over"].includes(trade.status ?? ""))
      .sort((a, b) => Number(NEEDS_ME.includes(b.phase)) - Number(NEEDS_ME.includes(a.phase)));
    return { open: openList, closed: withPhase.filter(({ trade }) => !["negotiating", "scheduled", "handed_over"].includes(trade.status ?? "")) };
  }, [trades, userId]);

  const list = tab === "open" ? open : closed;

  return (
    <div>
      <PageHeader title="取引">
        <div className="px-4 pb-3">
          <Tabs value={tab} onChange={setTab} options={[{ value: "open", label: "進行中", count: open.filter((o) => NEEDS_ME.includes(o.phase)).length }, { value: "closed", label: "終了" }]} />
        </div>
      </PageHeader>

      <div className="px-4 pt-3 lg:px-0">
        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title={tab === "open" ? "進行中の取引はありません" : "終了した取引はありません"}
            description={tab === "open" ? "気になる教科書を見つけたら「取引をリクエスト」から始めましょう。" : undefined}
            action={tab === "open" && <ButtonLink href="/" variant="secondary">教科書を探す</ButtonLink>}
          />
        ) : (
          <ul className="-mx-4 divide-y divide-border border-y border-border lg:mx-0 lg:rounded-lg lg:border">
            {list.map(({ trade, phase }) => {
              const label = phaseLabel(phase, trade, university.meetup_slots);
              const thumb = itemThumbUrl(trade.item_image);
              const unread = trade.unread_count ?? 0;
              return (
                <li key={trade.id}>
                  <Link href={`/trades/${trade.id}`} className="flex gap-3 px-4 py-3.5 hover:bg-surface-2">
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded border border-border bg-surface-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <BookOpen className="m-auto mt-4 size-6 text-subtle" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 text-muted">
                          {trade.my_role === "buyer" ? "購入" : "出品"}
                        </span>
                        <p className="truncate text-sm font-semibold">{trade.item_title}</p>
                      </div>
                      <p className={cn("mt-1 truncate text-[13px]", label.tone === "accent" ? "font-semibold text-primary" : label.tone === "primary" ? "text-fg" : label.tone === "success" ? "text-success" : "text-muted")}>
                        {label.text}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {trade.counterpart_nickname} ・ {yen(trade.price ?? 0)} ・ {trade.last_message_preview}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[11px] text-subtle">{trade.last_message_at ? timeAgo(trade.last_message_at) : ""}</span>
                      {unread > 0 && (
                        <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{unread}</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
