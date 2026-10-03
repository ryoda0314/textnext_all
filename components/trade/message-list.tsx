"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { clockTime, dateLabel, dayHeading, yen } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { cancelLabel, formatSlot } from "@/lib/trade-status";
import type { MeetupSlot, Message, SlotChoice, Spot } from "@/lib/types";

type Person = { id: string; nickname: string; avatar_path: string | null } | null | undefined;

function useSignedUrls(paths: string[]) {
  const key = paths.join("|");
  return useQuery({
    queryKey: ["chat-images", key],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data } = await getSupabase().storage.from("chat-images").createSignedUrls(paths, 3600);
      return Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl]));
    },
  });
}

export function MessageList({
  messages,
  me,
  counterpart,
  slots,
  spots,
  onChooseProposal,
  latestProposalId,
}: {
  messages: Message[];
  me: string;
  counterpart: Person;
  slots: MeetupSlot[];
  spots: Spot[];
  onChooseProposal?: () => void;
  latestProposalId: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const imagePaths = useMemo(() => messages.filter((m) => m.kind === "image" && m.image_path).map((m) => m.image_path!), [messages]);
  const { data: imageUrls } = useSignedUrls(imagePaths);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? "（削除された場所）";

  return (
    <div className="space-y-2 px-3 py-4">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
        const mine = message.sender_id === me;
        const groupedWithPrevious = previous && previous.sender_id === message.sender_id && previous.kind !== "system" && !newDay;

        return (
          <Fragment key={message.id}>
            {newDay && (
              <div className="flex items-center gap-3 py-2 text-[11px] text-subtle">
                <span className="h-px flex-1 bg-border" />
                {dayHeading(message.created_at)}
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            {message.kind === "system" ? (
              <SystemMessage
                message={message}
                me={me}
                counterpartName={counterpart?.nickname ?? "相手"}
                slots={slots}
                spotName={spotName}
                isLatestProposal={message.id === latestProposalId}
                onChooseProposal={onChooseProposal}
              />
            ) : (
              <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", groupedWithPrevious ? "mt-0.5" : "mt-3")}>
                {!mine && (
                  <div className="w-8 shrink-0">
                    {!groupedWithPrevious && counterpart && <Avatar path={counterpart.avatar_path} name={counterpart.nickname} seed={counterpart.id} size={32} />}
                  </div>
                )}
                {mine && <span className="mb-0.5 text-[10px] text-subtle">{clockTime(message.created_at)}</span>}
                {message.kind === "image" ? (
                  <a href={imageUrls?.[message.image_path!]} target="_blank" rel="noopener noreferrer" className="block max-w-[65%] overflow-hidden rounded-lg border border-border bg-surface-2">
                    {imageUrls?.[message.image_path!] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrls[message.image_path!]} alt="送信された画像" className="max-h-72 w-auto object-cover" />
                    ) : (
                      <div className="size-40 animate-shimmer" />
                    )}
                  </a>
                ) : (
                  <p
                    className={cn(
                      "max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                      mine ? "rounded-br-sm bg-primary text-primary-fg" : "rounded-bl-sm bg-surface-2",
                    )}
                  >
                    {message.body}
                  </p>
                )}
                {!mine && <span className="mb-0.5 text-[10px] text-subtle">{clockTime(message.created_at)}</span>}
              </div>
            )}
          </Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function SystemMessage({
  message,
  me,
  counterpartName,
  slots,
  spotName,
  isLatestProposal,
  onChooseProposal,
}: {
  message: Message;
  me: string;
  counterpartName: string;
  slots: MeetupSlot[];
  spotName: (id: string) => string;
  isLatestProposal: boolean;
  onChooseProposal?: () => void;
}) {
  const payload = (message.payload ?? {}) as Record<string, unknown>;
  const byMe = payload.by === me;
  const who = byMe ? "あなた" : `${counterpartName}さん`;

  switch (message.event) {
    case "requested": {
      const method = PAYMENT_METHODS[payload.payment_method as PaymentMethod]?.label;
      return (
        <Pill>
          取引リクエスト（{yen(Number(payload.price ?? 0))}{method ? `・${method}` : ""}）
        </Pill>
      );
    }
    case "proposal": {
      const proposalSlots = (payload.slots as SlotChoice[] | undefined) ?? [];
      const spotIds = (payload.spot_ids as string[] | undefined) ?? [];
      const other = payload.other_place as string | null;
      const previous = payload.previous as { date: string; place: string } | null;
      const actionable = isLatestProposal && !byMe && onChooseProposal;
      return (
        <div className="mx-auto my-3 w-full max-w-sm rounded-lg border border-border bg-bg p-3.5">
          <p className="text-xs text-muted">{previous ? `${who}から日程変更の候補` : `${who}の受け渡し候補`}</p>
          <ul className="mt-2 space-y-0.5 text-sm font-semibold">
            {proposalSlots.map((s) => <li key={`${s.date}-${s.slot}`} className="tabular">{formatSlot(s, slots)}</li>)}
          </ul>
          <p className="mt-2 flex items-start gap-1 text-sm text-muted">
            <MapPin className="mt-[3px] size-3.5 shrink-0" />
            {[...spotIds.map(spotName), ...(other ? [other] : [])].join("・")}
          </p>
          {typeof payload.note === "string" && payload.note && <p className="mt-2 text-xs leading-relaxed text-muted">「{payload.note}」</p>}
          {actionable && (
            <button type="button" onClick={onChooseProposal} className="mt-3 h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-fg">
              この中から選んで確定する
            </button>
          )}
        </div>
      );
    }
    case "confirmed": {
      return (
        <div className="mx-auto my-3 w-full max-w-sm rounded-lg border border-primary/30 bg-primary-soft/60 p-3.5">
          <p className="text-xs font-semibold text-primary-soft-fg">受け渡し日時が決まりました</p>
          <p className="tabular mt-1.5 text-base font-semibold">
            {dateLabel(String(payload.date))} {String(payload.time ?? payload.slot_label ?? "")}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm"><MapPin className="size-3.5" />{String(payload.place ?? "")}</p>
        </div>
      );
    }
    case "handover_reported":
      return <Pill>{byMe ? "受け渡し完了を報告しました" : `${counterpartName}さんが受け渡し完了を報告しました`}</Pill>;
    case "handed_over":
      return <Pill tone="success">受け渡しが完了しました</Pill>;
    case "rated":
      return <Pill>{byMe ? "評価を送りました" : `${counterpartName}さんが評価しました`}</Pill>;
    case "completed":
      return <Pill tone="success">取引が完了しました</Pill>;
    case "cancelled":
      return (
        <div className="mx-auto my-3 w-full max-w-sm rounded-lg border border-border p-3.5 text-center">
          <p className="text-sm font-semibold text-muted">{cancelLabel(payload.reason as string)}</p>
          {typeof payload.note === "string" && payload.note && <p className="mt-1 text-xs leading-relaxed text-muted">「{payload.note}」</p>}
        </div>
      );
    default:
      return <Pill>{message.body}</Pill>;
  }
}

function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "success" }) {
  return <p className={cn("py-1.5 text-center text-xs", tone === "success" ? "font-semibold text-success" : "text-muted")}>{children}</p>;
}
