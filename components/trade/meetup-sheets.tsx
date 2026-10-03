"use client";

import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { useMember } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { Sheet, SheetFooter } from "@/components/ui/sheet";
import { cn, orNull } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { todayJst } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { formatSlot } from "@/lib/trade-status";
import type { Proposal, SlotChoice } from "@/lib/types";
import { SlotPicker, sortSlots } from "./slot-picker";
import { filterSpots, SpotPicker, spotValueValid, type SpotValue } from "./spot-picker";

/** Pick one slot + one place from the other person's proposal. */
export function ConfirmMeetupSheet({
  open,
  onClose,
  ...props
}: {
  open: boolean;
  onClose: () => void;
  tradeId: string;
  proposal: Proposal;
  onDone: () => void;
  onPropose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="日時と場所を決める" description="候補から1つずつ選んでください">
      <ConfirmMeetupForm {...props} onClose={onClose} />
    </Sheet>
  );
}

function ConfirmMeetupForm({
  onClose,
  tradeId,
  proposal,
  onDone,
  onPropose,
}: {
  onClose: () => void;
  tradeId: string;
  proposal: Proposal;
  onDone: () => void;
  onPropose: () => void;
}) {
  const { university } = useMember();
  const { toast } = useFeedback();
  const today = todayJst();
  const slots = proposal.slots.filter((s) => s.date >= today);
  const places = [
    ...proposal.spot_ids.map((id) => ({ id, name: university.spots.find((s) => s.id === id)?.name ?? "（削除された場所）" })),
    ...(proposal.other_place ? [{ id: "other", name: proposal.other_place }] : []),
  ];
  // Mounted each time the sheet opens, so these start fresh (single options are preselected).
  const [slot, setSlot] = useState<SlotChoice | null>(() => (slots.length === 1 ? slots[0] : null));
  const [place, setPlace] = useState<string | null>(() => (places.length === 1 ? places[0].id : null));
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!slot || !place) return;
    setSaving(true);
    const { error } = await getSupabase().rpc("confirm_meetup", {
      p_trade_id: tradeId,
      p_date: slot.date,
      p_slot: slot.slot,
      p_spot_id: place === "other" ? undefined : place,
      p_time: time || undefined,
    });
    setSaving(false);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast("受け渡し日時を確定しました");
    onDone();
    onClose();
  }

  return (
    <div className="space-y-6 pt-1">
      {slots.length === 0 ? (
        <Notice tone="warning">候補の日付がすべて過ぎています。新しい候補を出してください。</Notice>
      ) : (
        <section className="space-y-2">
          <h3 className="text-sm font-bold">日時</h3>
          <div className="grid gap-2">
            {slots.map((s) => {
              const on = slot?.date === s.date && slot.slot === s.slot;
              return (
                <button key={`${s.date}-${s.slot}`} type="button" role="radio" aria-checked={on} onClick={() => setSlot(s)}
                  className={cn("flex h-12 items-center gap-3 rounded-xl border px-4 text-left font-bold", on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border hover:bg-surface-2")}>
                  <span className={cn("size-4 rounded-full border-2", on ? "border-primary bg-primary" : "border-border-strong")} />
                  <span className="tabular">{formatSlot(s, university.meetup_slots)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold">場所</h3>
        <div className="grid gap-2">
          {places.map((p) => {
            const on = place === p.id;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPlace(p.id)}
                className={cn("flex h-12 items-center gap-3 rounded-xl border px-4 text-left font-bold", on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border hover:bg-surface-2")}>
                <MapPin className="size-4" />
                {p.name}
              </button>
            );
          })}
        </div>
      </section>

      <Field label="時刻（任意）" htmlFor="meetup-time" hint="「12:30」のように決めておくと待ち合わせがスムーズです">
        <Input id="meetup-time" type="time" min="07:00" max="20:00" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="tabular" />
      </Field>

      <button type="button" onClick={() => { onClose(); onPropose(); }} className="w-full text-center text-sm font-bold text-primary">
        どれも都合が合わない → 別の候補を出す
      </button>

      <SheetFooter>
        <Button size="lg" className="w-full" disabled={!slot || !place} loading={saving} onClick={confirm}>
          この内容で確定する
        </Button>
      </SheetFooter>
    </div>
  );
}

/** Offer new candidate slots/places (also used to reschedule a confirmed meet-up). */
export function ProposeMeetupSheet({
  open,
  onClose,
  tradeId,
  campusId,
  rescheduling,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeId: string;
  campusId: string | null;
  rescheduling: boolean;
  onDone: () => void;
}) {
  const { university } = useMember();
  const { toast } = useFeedback();
  const spots = useMemo(() => filterSpots(university.spots, campusId), [university.spots, campusId]);
  const [slots, setSlots] = useState<SlotChoice[]>([]);
  const [place, setPlace] = useState<SpotValue>({ spotIds: [], other: null });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function send() {
    setSaving(true);
    const { error } = await getSupabase().rpc("propose_meetup", {
      p_trade_id: tradeId,
      p_slots: sortSlots(slots, university.meetup_slots),
      p_spot_ids: place.spotIds,
      p_other_place: orNull(place.other?.trim() || null),
      p_note: orNull(note.trim() || null),
    });
    setSaving(false);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast("候補を送りました");
    setSlots([]);
    setNote("");
    onDone();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={rescheduling ? "日程を変更する" : "別の候補を出す"}
      description={rescheduling ? "確定済みの日時はいったん取り消され、相手が新しい候補から選びます。" : "相手が都合の良いものを選んで確定します。"}
      footer={
        <Button size="lg" className="w-full" disabled={slots.length === 0 || !spotValueValid(place)} loading={saving} onClick={send}>
          候補を送る
        </Button>
      }
    >
      <div className="space-y-6 pt-1">
        <section className="space-y-2">
          <h3 className="text-sm font-bold">日時</h3>
          <SlotPicker slots={university.meetup_slots} value={slots} onChange={setSlots} />
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-bold">場所</h3>
          <SpotPicker spots={spots} value={place} onChange={setPlace} />
        </section>
        <Field label="ひとこと（任意）" htmlFor="propose-note">
          <Input id="propose-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="例: 水曜なら授業後すぐ行けます" />
        </Field>
      </div>
    </Sheet>
  );
}
