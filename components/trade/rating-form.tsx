"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { cn, orNull } from "@/lib/cn";
import { LIMITS, RATING_SCORES, type RatingScore } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export function RatingForm({ tradeId, counterpartName, onDone }: { tradeId: string; counterpartName: string; onDone: () => void }) {
  const { toast } = useFeedback();
  const [score, setScore] = useState<RatingScore | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!score) return;
    setSaving(true);
    const { data, error } = await getSupabase().rpc("rate_trade", { p_trade_id: tradeId, p_score: score, p_comment: orNull(comment.trim() || null) });
    setSaving(false);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast((data as { completed: boolean }).completed ? "評価を送りました。取引が完了しました！" : "評価を送りました");
    onDone();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{counterpartName}さんとの取引はどうでしたか？</p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(RATING_SCORES) as RatingScore[]).map((s) => (
          <button key={s} type="button" aria-pressed={score === s} onClick={() => setScore(s)}
            className={cn("h-11 rounded-lg border text-sm transition-colors", score === s ? "border-primary bg-primary-soft font-semibold text-primary-soft-fg" : "border-border bg-surface hover:bg-surface-2")}>
            {RATING_SCORES[s].label}
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={LIMITS.ratingCommentMax} rows={2} placeholder="ひとこと（任意）例: 時間通りに来てくださり、ありがとうございました！" aria-label="コメント" />
      <Button className="w-full" disabled={!score} loading={saving} onClick={submit}>評価を送る</Button>
      <p className="text-center text-[11px] text-muted">評価はお互いの評価がそろうまで相手には見えません</p>
    </div>
  );
}
