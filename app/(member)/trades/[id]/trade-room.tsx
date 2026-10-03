"use client";

import { BookOpen, ChevronLeft, Flag, MoreHorizontal, User, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ReportSheet } from "@/components/report-sheet";
import { useMember } from "@/components/session";
import { CancelSheet } from "@/components/trade/cancel-sheet";
import { Composer } from "@/components/trade/composer";
import { ReceiveSheet, ShowCodeSheet } from "@/components/trade/handover-sheets";
import { ConfirmMeetupSheet, ProposeMeetupSheet } from "@/components/trade/meetup-sheets";
import { MessageList } from "@/components/trade/message-list";
import { RatingForm } from "@/components/trade/rating-form";
import { StatusPanel } from "@/components/trade/status-panel";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { PageSpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { yen } from "@/lib/format";
import { useTrade } from "@/lib/hooks/use-trade";
import { itemThumbUrl } from "@/lib/images";
import { getSupabase } from "@/lib/supabase/client";
import { asProposal, tradePhase } from "@/lib/trade-status";

type SheetName = "confirm" | "propose" | "reschedule" | "code" | "receive" | "cancel" | "report" | "rate" | "menu";

export function TradeRoom({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, university } = useMember();
  const { toast, confirm } = useFeedback();
  const { trade: tradeQuery, counterpart: counterpartQuery, messages: messagesQuery, ratings, refresh } = useTrade(id, userId);
  const [chosenSheet, setChosenSheet] = useState<SheetName | null>(null);
  const [codeHandled, setCodeHandled] = useState(false);
  const codeParam = params.get("code");

  const trade = tradeQuery.data;
  const open = trade ? ["negotiating", "scheduled"].includes(trade.status) : false;

  // Arriving from the seller's QR (camera app → URL with ?code=) opens the receive flow once.
  const autoReceive = Boolean(codeParam && trade && trade.buyer_id === userId && open && !codeHandled);
  const sheet: SheetName | null = chosenSheet ?? (autoReceive ? "receive" : null);
  const setSheet = (next: SheetName | null) => {
    setCodeHandled(true);
    setChosenSheet(next);
  };

  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const latestProposalId = useMemo(() => {
    if (!trade || trade.status !== "negotiating" || !trade.proposal) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].event === "proposal") return messages[i].id;
    }
    return null;
  }, [messages, trade]);

  if (tradeQuery.isPending) return <PageSpinner />;
  if (!trade) {
    return (
      <EmptyState className="pt-safe" icon={<BookOpen />} title="取引が見つかりません" action={<ButtonLink href="/trades" variant="secondary">取引一覧へ</ButtonLink>} />
    );
  }

  const role = trade.buyer_id === userId ? "buyer" : "seller";
  const counterpart = counterpartQuery.data;
  const counterpartName = counterpart?.nickname ?? "相手";
  const iRated = ratings.data?.some((r) => r.rater_id === userId) ?? false;
  const theirRating = ratings.data?.find((r) => r.rater_id !== userId) ?? null;
  const phase = tradePhase(trade, userId, iRated);
  const proposal = asProposal(trade.proposal);
  const chatOpen = ["negotiating", "scheduled", "handed_over"].includes(trade.status);
  const thumb = itemThumbUrl(trade.item_image);
  const close = () => setSheet(null);

  async function confirmHandover() {
    const ok = await confirm({
      title: "受け渡し済みを報告しますか？",
      message: "商品と代金の受け渡しが済んでいる場合だけ報告してください。相手も確認すると受け渡し完了になります。",
      confirmLabel: "報告する",
    });
    if (!ok) return;
    const { data, error } = await getSupabase().rpc("confirm_handover", { p_trade_id: id });
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    toast((data as { both: boolean }).both ? "受け渡しが完了しました！" : "報告しました。相手の確認を待っています");
    refresh();
  }

  return (
    <div className="flex h-dvh flex-col lg:mx-auto lg:h-[calc(100dvh-4rem)] lg:max-w-3xl lg:border-x lg:border-border">
      <header className="shrink-0 border-b border-border bg-surface/95 pt-safe backdrop-blur-xl">
        <div className="flex h-14 items-center gap-1 px-2">
          <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/trades"))} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2" aria-label="戻る">
            <ChevronLeft className="size-6" />
          </button>
          <Link href={counterpart && !counterpart.deleted_at ? `/users/${counterpart.id}` : "#"} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar path={counterpart?.avatar_path} name={counterpartName} seed={counterpart?.id} size={34} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight">{counterpartName}</p>
              <p className="truncate text-[11px] text-muted">{role === "buyer" ? "出品者" : "購入希望者"}</p>
            </div>
          </Link>
          <Link href={`/items/${trade.item_id}`} className="flex max-w-[45%] items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2">
            <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb && <img src={thumb} alt="" className="size-full object-cover" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold">{trade.item_title}</span>
              <span className="tabular block text-xs font-bold">{yen(trade.price)}</span>
            </span>
          </Link>
          <button type="button" onClick={() => setSheet("menu")} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2" aria-label="メニュー">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      </header>

      <StatusPanel
        trade={trade}
        phase={phase}
        role={role}
        counterpartName={counterpartName}
        slots={university.meetup_slots}
        theirRating={trade.status === "completed" ? theirRating : null}
        actions={{
          choose: () => setSheet("confirm"),
          propose: () => setSheet("propose"),
          reschedule: () => setSheet("reschedule"),
          showCode: () => setSheet("code"),
          receive: () => setSheet("receive"),
          confirmHandover,
          rate: () => setSheet("rate"),
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg">
        {messagesQuery.isPending ? (
          <PageSpinner />
        ) : (
          <MessageList
            messages={messages}
            me={userId}
            counterpart={counterpart}
            slots={university.meetup_slots}
            spots={university.spots}
            latestProposalId={latestProposalId}
            onChooseProposal={() => setSheet("confirm")}
          />
        )}
      </div>

      {chatOpen ? (
        <Composer tradeId={id} status={trade.status} />
      ) : (
        <div className="shrink-0 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-muted">
          この取引は終了しています。メッセージは送れません。
        </div>
      )}

      {proposal && phase === "choose_meetup" && (
        <ConfirmMeetupSheet open={sheet === "confirm"} onClose={close} tradeId={id} proposal={proposal} onDone={refresh} onPropose={() => setSheet("propose")} />
      )}
      <ProposeMeetupSheet
        open={sheet === "propose" || sheet === "reschedule"}
        onClose={close}
        tradeId={id}
        campusId={null}
        rescheduling={sheet === "reschedule"}
        onDone={refresh}
      />
      {role === "seller" && <ShowCodeSheet open={sheet === "code"} onClose={close} tradeId={id} handedOver={trade.status === "handed_over"} />}
      {role === "buyer" && <ReceiveSheet open={sheet === "receive"} onClose={close} tradeId={id} initialCode={codeParam} onDone={refresh} />}
      <CancelSheet open={sheet === "cancel"} onClose={close} tradeId={id} role={role} onDone={refresh} />
      {counterpart && <ReportSheet open={sheet === "report"} onClose={close} targetType="trade" targetId={id} reasons={["no_show", "harassment", "external_contact", "misleading", "other"]} />}
      <Sheet open={sheet === "rate"} onClose={close} title="取引相手を評価">
        <div className="pt-1">
          <RatingForm tradeId={id} counterpartName={counterpartName} onDone={() => { close(); refresh(); }} />
        </div>
      </Sheet>

      <Sheet open={sheet === "menu"} onClose={close} size="sm" title="メニュー">
        <div className="space-y-1">
          <MenuLink href={`/items/${trade.item_id}`} icon={<BookOpen className="size-5" />}>商品を見る</MenuLink>
          {counterpart && !counterpart.deleted_at && <MenuLink href={`/users/${counterpart.id}`} icon={<User className="size-5" />}>{counterpartName}さんのプロフィール</MenuLink>}
          {open && (
            <MenuButton icon={<XCircle className="size-5" />} danger onClick={() => setSheet("cancel")}>取引をキャンセル</MenuButton>
          )}
          <MenuButton icon={<Flag className="size-5" />} danger onClick={() => setSheet("report")}>運営に通報する</MenuButton>
        </div>
      </Sheet>
    </div>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 font-bold hover:bg-surface-2">
      {icon}
      {children}
    </Link>
  );
}

function MenuButton({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left font-bold hover:bg-surface-2", danger && "text-danger")}>
      {icon}
      {children}
    </button>
  );
}
