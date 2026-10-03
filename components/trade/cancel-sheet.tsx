"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { cn, orNull } from "@/lib/cn";
import { CANCEL_REASONS, type CancelReason } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export function CancelSheet({ open, onClose, tradeId, role, onDone }: { open: boolean; onClose: () => void; tradeId: string; role: "buyer" | "seller"; onDone: () => void }) {
  const { toast } = useFeedback();
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const reasons = (Object.keys(CANCEL_REASONS) as CancelReason[]).filter((r) => CANCEL_REASONS[r].who === "both" || CANCEL_REASONS[r].who === role);
  const noteRequired = reason === "other";

  async function submit() {
    if (!reason) return;
    setSaving(true);
    const { error } = await getSupabase().rpc("cancel_trade", { p_trade_id: tradeId, p_reason: reason, p_note: orNull(note.trim() || null) });
    setSaving(false);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast("取引をキャンセルしました");
    onDone();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="取引をキャンセル"
      description="相手に理由が伝わります。受け渡しの前ならキャンセルできます。"
      footer={
        <Button variant="danger" size="lg" className="w-full" disabled={!reason || (noteRequired && note.trim().length < 4)} loading={saving} onClick={submit}>
          キャンセルする
        </Button>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="space-y-2" role="radiogroup" aria-label="キャンセルの理由">
          {reasons.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)}
              className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold", reason === r ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border hover:bg-surface-2")}>
              <span className={cn("size-4 shrink-0 rounded-full border-2", reason === r ? "border-primary bg-primary" : "border-border-strong")} />
              {CANCEL_REASONS[r].label}
            </button>
          ))}
        </div>
        <Field label={noteRequired ? "理由" : "相手へのひとこと（任意）"} htmlFor="cancel-note" required={noteRequired} counter={{ value: note.length, max: 300 }}>
          <Textarea id="cancel-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder="例: 授業の都合で受け取りに行けなくなりました。すみません。" />
        </Field>
        <p className="text-xs leading-relaxed text-muted">正当な理由のないキャンセルが続くと、利用制限の対象になることがあります。</p>
      </div>
    </Sheet>
  );
}
