"use client";

import { QrCode, ScanLine } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { RATING_SCORES, type RatingScore } from "@/lib/constants";
import { cancelLabel, meetupSummary, type TradePhase } from "@/lib/trade-status";
import type { MeetupSlot, Trade } from "@/lib/types";

type Actions = {
  choose: () => void;
  propose: () => void;
  reschedule: () => void;
  showCode: () => void;
  receive: () => void;
  confirmHandover: () => void;
  rate: () => void;
};

const STEPS = ["リクエスト", "日時の確定", "受け渡し", "評価"];

const STEP_OF: Record<TradePhase, number> = {
  choose_meetup: 1,
  waiting_meetup: 1,
  scheduled: 2,
  confirm_handover: 2,
  rate: 3,
  waiting_rating: 3,
  completed: 4,
  cancelled: -1,
};

export function StatusPanel({
  trade,
  phase,
  role,
  counterpartName,
  slots,
  theirRating,
  actions,
}: {
  trade: Trade;
  phase: TradePhase;
  role: "buyer" | "seller";
  counterpartName: string;
  slots: MeetupSlot[];
  theirRating?: { score: string; comment: string | null } | null;
  actions: Actions;
}) {
  const meetup = meetupSummary(trade, slots);
  const handoverButton =
    role === "seller" ? (
      <Button onClick={actions.showCode} icon={<QrCode className="size-4" />} className="flex-1">受け渡しコードを表示</Button>
    ) : (
      <Button onClick={actions.receive} icon={<ScanLine className="size-4" />} className="flex-1">商品を受け取る</Button>
    );
  const fallbackLink = (
    <button type="button" onClick={actions.confirmHandover} className="text-xs text-muted underline underline-offset-2 hover:text-fg">
      コードが使えないときは「受け渡し済み」を報告
    </button>
  );

  if (phase === "cancelled") {
    return (
      <Panel step={-1} title={cancelLabel(trade.cancel_reason)} subtitle={trade.cancel_note ? `「${trade.cancel_note}」` : "この取引は終了しました。"} />
    );
  }

  switch (phase) {
    case "choose_meetup":
      return (
        <Panel step={STEP_OF[phase]} title="候補から日時と場所を選んでください" subtitle={`${counterpartName}さんが受け渡しの候補を送りました。`}>
          <div className="flex gap-2">
            <Button onClick={actions.choose} className="flex-1">選んで確定する</Button>
            <Button variant="outline" onClick={actions.propose}>別の候補</Button>
          </div>
        </Panel>
      );
    case "waiting_meetup":
      return (
        <Panel step={STEP_OF[phase]} title="相手が日時を選ぶのを待っています" subtitle="確定すると通知が届きます。候補はいつでも出し直せます。">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="outline" size="sm" onClick={actions.propose}>候補を出し直す</Button>
            <button type="button" onClick={role === "seller" ? actions.showCode : actions.receive} className="text-xs text-primary underline underline-offset-2">
              {role === "seller" ? "もう会えたら、受け渡しコードを表示" : "もう会えたら、商品を受け取る"}
            </button>
          </div>
        </Panel>
      );
    case "scheduled":
      return (
        <Panel step={STEP_OF[phase]} title={meetup ? `${meetup.when}・${meetup.place}` : "日時が決まりました"} subtitle="受け渡しの日時が決まりました。">
          <div className="flex gap-2">
            {handoverButton}
            <Button variant="outline" onClick={actions.reschedule}>日程変更</Button>
          </div>
          <div className="mt-2.5">{fallbackLink}</div>
        </Panel>
      );
    case "confirm_handover":
      return (
        <Panel step={STEP_OF[phase]} title={`${counterpartName}さんが受け渡し完了を報告しました`} subtitle="商品と代金の受け渡しが済んでいれば、確認してください。">
          <div className="flex gap-2">
            <Button onClick={actions.confirmHandover} className="flex-1">受け渡し完了を確認</Button>
            {role === "buyer" && <Button variant="outline" onClick={actions.receive}>コードで受け取る</Button>}
          </div>
        </Panel>
      );
    case "rate":
      return (
        <Panel step={STEP_OF[phase]} title="受け渡しが完了しました。取引相手を評価してください" subtitle="お互いの評価がそろうと取引完了です。">
          <Button onClick={actions.rate} className="w-full">評価する</Button>
        </Panel>
      );
    case "waiting_rating":
      return <Panel step={STEP_OF[phase]} title="評価を送りました" subtitle={`${counterpartName}さんの評価を待っています。7日たつと自動で取引完了になります。`} />;
    case "completed": {
      const score = theirRating ? RATING_SCORES[theirRating.score as RatingScore] : null;
      return (
        <Panel step={STEP_OF[phase]} title="取引が完了しました" subtitle="ご利用ありがとうございました。">
          {score && (
            <p className="text-sm">
              {counterpartName}さんからの評価：<span className="font-semibold">{score.label}</span>
              {theirRating?.comment && <span className="mt-0.5 block text-xs text-muted">「{theirRating.comment}」</span>}
            </p>
          )}
        </Panel>
      );
    }
  }
}

function Panel({ step, title, subtitle, children }: { step: number; title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-border bg-bg px-4 pb-4 pt-3">
      {step >= 0 && (
        <ol className="mb-3 flex gap-1.5" aria-label="取引の進み具合">
          {STEPS.map((label, i) => (
            <li key={label} className="min-w-0 flex-1" aria-current={i === step ? "step" : undefined}>
              <div className={cn("h-1 rounded-full", i < step ? "bg-primary" : i === step ? "bg-primary/35" : "bg-surface-3")} />
              <p className={cn("mt-1 truncate text-[11px]", i <= step ? "font-semibold text-fg" : "text-subtle")}>{label}</p>
            </li>
          ))}
        </ol>
      )}
      <p className="tabular text-[15px] font-semibold leading-snug">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
