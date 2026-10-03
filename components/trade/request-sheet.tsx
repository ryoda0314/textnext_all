"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMember } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { Sheet, SheetFooter } from "@/components/ui/sheet";
import { orNull } from "@/lib/cn";
import { LIMITS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { errorCode, errorMessage } from "@/lib/errors";
import { readLocal } from "@/lib/hooks/use-local-storage";
import { yen } from "@/lib/format";
import { TRADE_RULES } from "@/lib/legal";
import { getSupabase } from "@/lib/supabase/client";
import type { SlotChoice } from "@/lib/types";
import { SlotPicker, sortSlots } from "./slot-picker";
import { filterSpots, SpotPicker, spotValueValid, type SpotValue } from "./spot-picker";

const PREFS_KEY = "textnext:request-prefs";

export function RequestSheet({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: { id: string; title: string; price: number; campus_id: string | null };
}) {
  return (
    <Sheet open={open} onClose={onClose} size="lg" title="取引リクエスト" description={`${item.title} ・ ${yen(item.price)}`}>
      <RequestForm item={item} />
    </Sheet>
  );
}

type Prefs = { payment?: PaymentMethod; spotIds?: string[]; agreed?: boolean };

/** Mounted when the sheet opens; starts from the member's last choices. */
function RequestForm({ item }: { item: { id: string; title: string; price: number; campus_id: string | null } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const { university } = useMember();
  const spots = useMemo(() => filterSpots(university.spots, item.campus_id), [university.spots, item.campus_id]);

  const [prefs] = useState(() => readLocal<Prefs>(PREFS_KEY, {}));
  const [payment, setPayment] = useState<PaymentMethod>(() => (prefs.payment && prefs.payment in PAYMENT_METHODS ? prefs.payment : "either"));
  const [slots, setSlots] = useState<SlotChoice[]>([]);
  const [place, setPlace] = useState<SpotValue>(() => ({
    spotIds: (prefs.spotIds ?? []).filter((id) => spots.some((s) => s.id === id)),
    other: null,
  }));
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(Boolean(prefs.agreed));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enoughSlots = slots.length >= LIMITS.minRequestSlots;
  const valid = enoughSlots && spotValueValid(place) && agreed && message.length <= LIMITS.requestMessageMax;

  async function send() {
    if (!valid) return;
    setSending(true);
    setError(null);
    const { data, error: rpcError } = await getSupabase().rpc("request_trade", {
      p_item_id: item.id,
      p_payment_method: payment,
      p_slots: sortSlots(slots, university.meetup_slots),
      p_spot_ids: place.spotIds,
      p_other_place: orNull(place.other?.trim() || null),
      p_message: orNull(message.trim() || null),
    });
    setSending(false);
    if (rpcError) {
      if (errorCode(rpcError) === "item_reserved") {
        queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      }
      setError(errorMessage(rpcError));
      return;
    }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ payment, spotIds: place.spotIds, agreed: true }));
    } catch {}
    queryClient.invalidateQueries({ queryKey: ["market"] });
    queryClient.invalidateQueries({ queryKey: ["my-trades"] });
    toast("取引リクエストを送りました");
    router.push(`/trades/${data}`);
  }

  return (
    <div className="space-y-7 pt-2">
      <section className="space-y-3">
        <h3 className="text-sm font-bold">支払い方法</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
            <Chip key={m} selected={payment === m} onClick={() => setPayment(m)}>
              {PAYMENT_METHODS[m].label}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted">支払いは受け渡しのときに直接行います。</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold">受け渡しできる日時</h3>
          <span className="text-xs text-muted">2つ以上選ぶと決まりやすくなります</span>
        </div>
        <SlotPicker slots={university.meetup_slots} value={slots} onChange={setSlots} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">受け渡しできる場所</h3>
        <SpotPicker spots={spots} value={place} onChange={setPlace} />
      </section>

      <Field label="メッセージ（任意）" htmlFor="request-message" counter={{ value: message.length, max: LIMITS.requestMessageMax }}>
        <Textarea id="request-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="はじめまして。授業で使うので購入を希望します。よろしくお願いします。" rows={3} />
      </Field>

      <section className="space-y-3 border-y border-border py-4">
        <h3 className="text-sm font-semibold">取引のルール
        </h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted">
          {TRADE_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
        <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm font-bold">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          ルールを確認しました
        </label>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        リクエストを送ると商品は「取引中」になり、出品者が候補から日時と場所を選ぶと確定します。リクエストは購入の確定ではなく、受け渡し前ならキャンセルできます。
      </p>
      {error && <Notice tone="danger">{error}</Notice>}

      <SheetFooter>
        <div className="space-y-2.5">
          <div className="flex gap-4 text-xs font-bold text-muted">
            <span className={enoughSlots ? "text-success" : undefined}>候補日時 {slots.length}/{LIMITS.minRequestSlots}以上</span>
            <span className={spotValueValid(place) ? "text-success" : undefined}>場所 {spotValueValid(place) ? "OK" : "未選択"}</span>
          </div>
          <Button size="lg" className="w-full" disabled={!valid} loading={sending} onClick={send}>
            この内容でリクエストする
          </Button>
        </div>
      </SheetFooter>
    </div>
  );
}
