"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { cn, orNull } from "@/lib/cn";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export function ReportSheet({
  open,
  onClose,
  targetType,
  targetId,
  reasons,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "item" | "user" | "trade";
  targetId: string;
  reasons?: ReportReason[];
}) {
  const { toast } = useFeedback();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const options = reasons ?? (Object.keys(REPORT_REASONS) as ReportReason[]);

  async function submit() {
    if (!reason) return;
    setSending(true);
    const { error } = await getSupabase().rpc("submit_report", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_detail: orNull(detail.trim() || null),
    });
    setSending(false);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast("通報を受け付けました。運営が確認します");
    setReason(null);
    setDetail("");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="運営に通報する"
      description="通報した人が相手に知られることはありません。"
      footer={
        <Button className="w-full" size="lg" variant="danger" disabled={!reason} loading={sending} onClick={submit}>
          通報する
        </Button>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="space-y-2" role="radiogroup" aria-label="理由">
          {options.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold",
                reason === r ? "border-danger bg-danger-soft text-danger" : "border-border hover:bg-surface-2",
              )}
            >
              <span className={cn("size-4 shrink-0 rounded-full border-2", reason === r ? "border-danger bg-danger" : "border-border-strong")} />
              {REPORT_REASONS[r]}
            </button>
          ))}
        </div>
        <Field label="詳しい状況（任意）" htmlFor="report-detail" counter={{ value: detail.length, max: 1000 }}>
          <Textarea id="report-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="いつ・何があったかを書いてください。個人情報は書かないでください。" />
        </Field>
        <p className="text-xs leading-relaxed text-muted">身の危険を感じる場合は、ためらわず大学の窓口や警察に相談してください。</p>
      </div>
    </Sheet>
  );
}
