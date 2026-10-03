import { CANCEL_REASONS, SYSTEM_CANCEL_LABELS } from "@/lib/constants";
import { dateLabel } from "@/lib/format";
import type { MeetupSlot, Proposal, SlotChoice } from "@/lib/types";

export type TradeLike = {
  status: string | null;
  proposal: unknown;
  buyer_id: string | null;
  seller_id: string | null;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  meetup_date: string | null;
  meetup_slot: string | null;
  meetup_time: string | null;
  meetup_place: string | null;
  cancel_reason?: string | null;
};

export type TradePhase =
  | "choose_meetup" // I need to pick from the other person's proposal
  | "waiting_meetup" // they need to pick from mine
  | "confirm_handover" // they reported the hand-over, I should confirm
  | "scheduled"
  | "rate" // I need to rate
  | "waiting_rating"
  | "completed"
  | "cancelled";

export function asProposal(value: unknown): Proposal | null {
  return value && typeof value === "object" && Array.isArray((value as Proposal).slots) ? (value as Proposal) : null;
}

export function tradePhase(trade: TradeLike, me: string, iRated: boolean): TradePhase {
  const iAmBuyer = trade.buyer_id === me;
  const theyReported = iAmBuyer ? trade.seller_confirmed_at && !trade.buyer_confirmed_at : trade.buyer_confirmed_at && !trade.seller_confirmed_at;
  switch (trade.status) {
    case "negotiating": {
      if (theyReported) return "confirm_handover";
      const proposal = asProposal(trade.proposal);
      return proposal && proposal.by !== me ? "choose_meetup" : "waiting_meetup";
    }
    case "scheduled":
      return theyReported ? "confirm_handover" : "scheduled";
    case "handed_over":
      return iRated ? "waiting_rating" : "rate";
    case "completed":
      return "completed";
    default:
      return "cancelled";
  }
}

export const NEEDS_ME: TradePhase[] = ["choose_meetup", "confirm_handover", "rate"];

export function slotLabel(slots: MeetupSlot[], id: string | null | undefined) {
  return slots.find((s) => s.id === id)?.label ?? id ?? "";
}

export function formatSlot(choice: SlotChoice, slots: MeetupSlot[]) {
  return `${dateLabel(choice.date)} ${slotLabel(slots, choice.slot)}`;
}

export function meetupSummary(trade: TradeLike, slots: MeetupSlot[]) {
  if (!trade.meetup_date) return null;
  const when = `${dateLabel(trade.meetup_date)} ${trade.meetup_time ?? slotLabel(slots, trade.meetup_slot)}`;
  return { when, place: trade.meetup_place ?? "" };
}

export function phaseLabel(phase: TradePhase, trade: TradeLike, slots: MeetupSlot[]) {
  switch (phase) {
    case "choose_meetup":
      return { text: "日時と場所を選んでください", tone: "accent" as const };
    case "waiting_meetup":
      return { text: "相手の返事を待っています", tone: "muted" as const };
    case "confirm_handover":
      return { text: "受け渡し完了を確認してください", tone: "accent" as const };
    case "scheduled": {
      const m = meetupSummary(trade, slots);
      return { text: m ? `${m.when}・${m.place}` : "日時が決まりました", tone: "primary" as const };
    }
    case "rate":
      return { text: "取引相手を評価してください", tone: "accent" as const };
    case "waiting_rating":
      return { text: "相手の評価を待っています", tone: "muted" as const };
    case "completed":
      return { text: "取引完了", tone: "success" as const };
    case "cancelled":
      return { text: cancelLabel(trade.cancel_reason), tone: "muted" as const };
  }
}

export function cancelLabel(reason: string | null | undefined) {
  if (!reason) return "キャンセル";
  if (reason in SYSTEM_CANCEL_LABELS) return SYSTEM_CANCEL_LABELS[reason];
  const r = CANCEL_REASONS[reason as keyof typeof CANCEL_REASONS];
  return r ? `キャンセル（${r.label.replace(/（.*）/, "")}）` : "キャンセル";
}
