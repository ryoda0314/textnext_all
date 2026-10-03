"use client";

import { useQuery } from "@tanstack/react-query";
import { Flag, Moon, UserX } from "lucide-react";
import { useState } from "react";
import { ItemCard, ItemGrid, ItemGridSkeleton } from "@/components/item-card";
import { RatingSummary } from "@/components/rating-summary";
import { ReportSheet } from "@/components/report-sheet";
import { useMember } from "@/components/session";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { gradeLabel, RATING_SCORES, type RatingScore } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

export function UserProfile({ id }: { id: string }) {
  const { userId } = useMember();
  const [reportOpen, setReportOpen] = useState(false);
  const supabase = getSupabase();

  const profile = useQuery({
    queryKey: ["profile", id, "full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_path, faculty, department, grade, bio, rating_good, rating_normal, rating_bad, completed_trades, listings_paused, deleted_at, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    queryKey: ["user-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, title, price, images, status, condition, favorite_count, course_name")
        .eq("seller_id", id)
        .in("status", ["active", "reserved"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const reviews = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_reviews", { p_user_id: id, p_limit: 20 });
      if (error) throw error;
      return data;
    },
  });

  if (profile.isPending) return <PageSpinner />;
  const p = profile.data;
  if (!p || p.deleted_at) {
    return (
      <>
        <PageHeader back="/" />
        <EmptyState icon={<UserX />} title="このユーザーは見つかりません" description="退会したか、別の大学のユーザーです。" />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title={p.nickname}
        back="/"
        actions={
          p.id !== userId && (
            <button type="button" onClick={() => setReportOpen(true)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="通報">
              <Flag className="size-4.5" />
            </button>
          )
        }
      />
      <div className="space-y-6 px-4 pb-8 pt-5 lg:px-0">
        <section className="flex items-center gap-4">
          <Avatar path={p.avatar_path} name={p.nickname} seed={p.id} size={72} />
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{p.nickname}</p>
            <p className="truncate text-sm text-muted">{[p.faculty, p.department, gradeLabel(p.grade)].filter(Boolean).join(" ・ ")}</p>
            <RatingSummary className="mt-1.5" good={p.rating_good} normal={p.rating_normal} bad={p.rating_bad} completed={p.completed_trades} />
          </div>
        </section>
        {p.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.bio}</p>}
        {p.listings_paused && (
          <Notice tone="warning" className="flex items-center gap-2"><Moon className="size-4.5" />現在おやすみ中です</Notice>
        )}
        {p.id === userId && <ButtonLink href="/me/edit" variant="secondary" className="w-full">プロフィールを編集</ButtonLink>}

        <section className="space-y-3">
          <h2 className="text-base font-bold">出品中の教科書</h2>
          {items.isPending ? (
            <ItemGridSkeleton count={4} />
          ) : (items.data ?? []).length === 0 || p.listings_paused ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">出品中の教科書はありません</p>
          ) : (
            <ItemGrid>{items.data!.map((item) => <ItemCard key={item.id} item={item} />)}</ItemGrid>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">評価</h2>
          {(reviews.data ?? []).length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">まだ評価はありません</p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {reviews.data!.map((r, i) => {
                const score = RATING_SCORES[r.score as RatingScore];
                return (
                  <li key={i} className="px-4 py-3.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{score?.label}</span>
                      <span className="text-xs text-muted">・{r.rater_role === "buyer" ? "購入者" : "出品者"}の{r.rater_nickname}さん</span>
                      <span className="ml-auto text-[11px] text-subtle">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{r.comment}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      {p.id !== userId && <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={p.id} reasons={["harassment", "no_show", "external_contact", "spam", "other"]} />}
    </div>
  );
}
