"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Heart,
  MessagesSquare,
  MoreHorizontal,
  PencilLine,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RatingSummary } from "@/components/rating-summary";
import { ReportSheet } from "@/components/report-sheet";
import { useMember } from "@/components/session";
import { RequestSheet } from "@/components/trade/request-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { PageSpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { CONDITIONS, gradeLabel, WRITING, type Condition, type Writing } from "@/lib/constants";
import { APP_URL } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { timeAgo, yen } from "@/lib/format";
import { itemImageUrl, removeItemImages } from "@/lib/images";
import { fetchIsFavorite, fetchItem, fetchOpenTradeForItem } from "@/lib/queries";
import { shareOrCopy } from "@/lib/share";
import { getSupabase } from "@/lib/supabase/client";
import { itemImages, type ItemImage } from "@/lib/types";
import { LibraryAvailability } from "./library-availability";

export function ItemDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const { userId, university } = useMember();
  const [requestOpen, setRequestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const itemQuery = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id) });
  const favoriteQuery = useQuery({ queryKey: ["favorite", id], queryFn: () => fetchIsFavorite(id, userId) });
  const tradeQuery = useQuery({ queryKey: ["item-trade", id], queryFn: () => fetchOpenTradeForItem(id) });

  const favorite = useMutation({
    mutationFn: async (next: boolean) => {
      const supabase = getSupabase();
      const { error } = next
        ? await supabase.from("favorites").insert({ user_id: userId, item_id: id })
        : await supabase.from("favorites").delete().eq("item_id", id).eq("user_id", userId);
      if (error && !/duplicate/i.test(error.message)) throw error;
    },
    onMutate: (next) => {
      queryClient.setQueryData(["favorite", id], next);
      queryClient.setQueryData(["item", id], (old: Awaited<ReturnType<typeof fetchItem>>) =>
        old ? { ...old, favorite_count: Math.max(0, old.favorite_count + (next ? 1 : -1)) } : old,
      );
    },
    onError: (error, next) => {
      queryClient.setQueryData(["favorite", id], !next);
      toast(errorMessage(error), "error");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const visibility = useMutation({
    mutationFn: async (status: "active" | "hidden") => {
      const { error } = await getSupabase().from("items").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast(status === "hidden" ? "非公開にしました" : "出品を再開しました");
      queryClient.invalidateQueries({ queryKey: ["item", id] });
      queryClient.invalidateQueries({ queryKey: ["market"] });
      queryClient.invalidateQueries({ queryKey: ["my-items"] });
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const item = itemQuery.data;
  if (itemQuery.isPending) return <PageSpinner />;
  if (!item || item.status === "removed") {
    return (
      <div className="pt-safe">
        <EmptyState icon={<BookOpen />} title="この商品は見つかりません" description="削除されたか、公開が停止されています。" action={<ButtonLink href="/" variant="secondary">ホームへ</ButtonLink>} />
      </div>
    );
  }

  const images = itemImages(item.images);
  const isOwner = item.seller_id === userId;
  const seller = item.seller;
  const sellerPaused = Boolean(seller?.listings_paused);
  const myTrade = tradeQuery.data;
  const isFavorite = Boolean(favoriteQuery.data);
  const condition = CONDITIONS[item.condition as Condition];
  const writing = WRITING[item.writing as Writing];

  async function remove() {
    const ok = await confirm({
      title: "この出品を削除しますか？",
      message: "削除すると元に戻せません。一時的に隠したい場合は「非公開にする」を使ってください。",
      confirmLabel: "削除する",
      danger: true,
    });
    if (!ok) return;
    const { data, error } = await getSupabase().rpc("delete_item", { p_item_id: id });
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    const result = data as { deleted: boolean; paths: string[] };
    if (result.deleted) await removeItemImages(result.paths).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ["market"] });
    queryClient.invalidateQueries({ queryKey: ["my-items"] });
    toast("出品を削除しました");
    router.replace("/me");
  }

  async function share() {
    const result = await shareOrCopy({ title: item!.title, text: `${item!.title}（${yen(item!.price)}）| TextNext`, url: `${APP_URL}/items/${id}` });
    if (result === "copied") toast("リンクをコピーしました");
  }

  return (
    <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:pb-10 lg:pt-8">
      <div className="relative">
        <Gallery images={images} title={item.title} dimmed={item.status !== "active"} />
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="戻る">
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={share} className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="共有">
              <Share2 className="size-5" />
            </button>
            <button type="button" onClick={() => setMenuOpen(true)} className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="メニュー">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 pt-5 lg:px-0 lg:pt-0">
        <div>
          {item.status !== "active" && (
            <p className="mb-2 text-xs font-semibold text-muted">
              {item.status === "reserved" ? "取引中" : item.status === "sold" ? "売り切れ" : "非公開（あなたにだけ表示されています）"}
            </p>
          )}
          <h1 className="text-xl font-bold leading-snug lg:text-2xl">{item.title}</h1>
          {(item.author || item.publisher) && <p className="mt-1 text-sm text-muted">{[item.author, item.publisher].filter(Boolean).join(" / ")}</p>}
          <div className="mt-4 flex items-baseline gap-2.5">
            <p className={cn("tabular text-[28px] font-bold leading-none", item.price === 0 && "text-accent")}>{yen(item.price)}</p>
            <p className="text-xs text-muted">
              定価 <span className="tabular">{yen(item.list_price)}</span>
              {item.price > 0 && <>の{Math.round((item.price / item.list_price) * 100)}%</>}
            </p>
          </div>
        </div>

        <div className="hidden gap-2 lg:flex">
          {actionButtons()}
          {favoriteButton()}
        </div>

        <dl className="divide-y divide-border border-y border-border text-sm">
          {condition && <Row label="状態">{condition.label}</Row>}
          {writing && <Row label="書き込み">{writing.label.replace("書き込み", "") || "なし"}</Row>}
          {item.course_name && <Row label="使った授業">{item.course_name}</Row>}
          {item.campus?.name && <Row label="キャンパス">{item.campus.name}</Row>}
          {item.isbn && <Row label="ISBN"><span className="tabular">{item.isbn}</span></Row>}
          <Row label="出品">{timeAgo(item.created_at)}</Row>
        </dl>

        {item.description && (
          <section>
            <h2 className="mb-1.5 text-sm font-semibold text-muted">説明</h2>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.description}</p>
          </section>
        )}

        {university.has_library && item.isbn && <LibraryAvailability isbn={item.isbn} />}

        {seller && (
          <Link href={isOwner ? "/me" : `/users/${seller.id}`} className="-mx-4 flex items-center gap-3 border-y border-border px-4 py-3.5 hover:bg-surface-2 lg:mx-0 lg:rounded-lg lg:border lg:px-4">
            <Avatar path={seller.avatar_path} name={seller.nickname} seed={seller.id} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{seller.nickname}{isOwner && <span className="ml-1.5 text-xs font-normal text-muted">（あなた）</span>}</p>
              <p className="truncate text-xs text-muted">{[seller.faculty, gradeLabel(seller.grade)].filter(Boolean).join(" ・ ")}</p>
              <RatingSummary className="mt-1" good={seller.rating_good} normal={seller.rating_normal} bad={seller.rating_bad} completed={seller.completed_trades} />
            </div>
            <ChevronRight className="size-4 text-subtle" />
          </Link>
        )}

        {sellerPaused && !isOwner && item.status === "active" && <Notice tone="warning">出品者は現在おやすみ中のため、取引リクエストを受け付けていません。</Notice>}

        {!isOwner && (
          <button type="button" onClick={() => setReportOpen(true)} className="hidden items-center gap-1.5 text-xs text-subtle hover:text-danger lg:inline-flex">
            <Flag className="size-3.5" />
            この出品を通報する
          </button>
        )}
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {!isOwner && favoriteButton()}
          {actionButtons()}
        </div>
      </div>

      <RequestSheet open={requestOpen} onClose={() => setRequestOpen(false)} item={{ id: item.id, title: item.title, price: item.price, campus_id: item.campus_id }} />
      {!isOwner && <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} targetType="item" targetId={item.id} reasons={["prohibited_item", "misleading", "spam", "other"]} />}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} size="sm" title="メニュー">
        <div className="space-y-1">
          <MenuButton icon={<Share2 className="size-5" />} onClick={() => { setMenuOpen(false); share(); }}>共有する</MenuButton>
          {isOwner ? (
            <>
              {(item.status === "active" || item.status === "hidden") && (
                <MenuButton icon={<PencilLine className="size-5" />} onClick={() => router.push(`/items/${id}/edit`)}>編集する</MenuButton>
              )}
              {item.status !== "reserved" && item.status !== "sold" && (
                <MenuButton icon={<Trash2 className="size-5" />} danger onClick={() => { setMenuOpen(false); remove(); }}>削除する</MenuButton>
              )}
            </>
          ) : (
            <MenuButton icon={<Flag className="size-5" />} danger onClick={() => { setMenuOpen(false); setReportOpen(true); }}>通報する</MenuButton>
          )}
        </div>
      </Sheet>
    </div>
  );

  function favoriteButton() {
    return (
      <button
        type="button"
        onClick={() => favorite.mutate(!isFavorite)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "いいねを取り消す" : "いいね"}
        className={cn(
          "flex h-12 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors",
          isFavorite ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:text-fg",
        )}
      >
        <Heart className={cn("size-5", isFavorite && "animate-pop fill-current")} />
        <span className="tabular">{item!.favorite_count}</span>
      </button>
    );
  }

  function actionButtons() {
    const it = item!;
    if (isOwner) {
      if (it.status === "reserved" || it.status === "sold") {
        return myTrade ? (
          <ButtonLink href={`/trades/${myTrade.id}`} size="lg" className="flex-1" icon={<MessagesSquare className="size-5" />}>取引画面を開く</ButtonLink>
        ) : (
          <Button size="lg" className="flex-1" disabled>{it.status === "sold" ? "売り切れ" : "取引中"}</Button>
        );
      }
      return (
        <>
          <ButtonLink href={`/items/${id}/edit`} variant="secondary" size="lg" className="flex-1" icon={<PencilLine className="size-5" />}>編集</ButtonLink>
          <Button
            variant={it.status === "hidden" ? "primary" : "outline"}
            size="lg"
            className="flex-1"
            loading={visibility.isPending}
            icon={it.status === "hidden" ? undefined : <EyeOff className="size-5" />}
            onClick={() => visibility.mutate(it.status === "hidden" ? "active" : "hidden")}
          >
            {it.status === "hidden" ? "出品を再開" : "非公開にする"}
          </Button>
        </>
      );
    }
    if (myTrade && myTrade.buyer_id === userId) {
      return <ButtonLink href={`/trades/${myTrade.id}`} size="lg" className="flex-1" icon={<MessagesSquare className="size-5" />}>取引画面を開く</ButtonLink>;
    }
    if (it.status === "reserved") {
      return (
        <Button size="lg" variant="secondary" className="flex-1 flex-col !gap-0 text-sm" onClick={() => !isFavorite && favorite.mutate(true)}>
          <span>ほかの人が取引中</span>
          <span className="text-[11px] font-normal text-muted">{isFavorite ? "購入できるようになったらお知らせします" : "いいねすると再開時にお知らせします"}</span>
        </Button>
      );
    }
    if (it.status === "sold") return <Button size="lg" className="flex-1" disabled>売り切れ</Button>;
    return (
      <Button size="lg" className="flex-1" disabled={sellerPaused} onClick={() => setRequestOpen(true)}>
        取引をリクエスト
      </Button>
    );
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function MenuButton({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left hover:bg-surface-2", danger && "text-danger")}>
      {icon}
      {children}
    </button>
  );
}

function Gallery({ images, title, dimmed }: { images: ItemImage[]; title: string; dimmed: boolean }) {
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return <div className="grid aspect-square place-items-center bg-surface-2 text-subtle lg:rounded-lg"><BookOpen className="size-10" strokeWidth={1.5} /></div>;
  }

  const go = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div className="relative overflow-hidden bg-surface-2 lg:rounded-lg">
        <div
          ref={scroller}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto scrollbar-none lg:aspect-[4/5]"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {images.map((image, i) => (
            <button key={image.path} type="button" className="relative size-full shrink-0 snap-center" onClick={() => setViewer(true)} aria-label={`写真 ${i + 1} を拡大`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemImageUrl(image, "full") ?? ""} alt={i === 0 ? title : ""} className={cn("size-full object-contain", dimmed && "opacity-80")} loading={i === 0 ? "eager" : "lazy"} />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((image, i) => <span key={image.path} className={cn("h-1.5 rounded-full bg-white/90 shadow transition-all", i === index ? "w-5" : "w-1.5 opacity-60")} />)}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 hidden gap-2 lg:flex">
          {images.map((image, i) => (
            <button key={image.path} type="button" onClick={() => go(i)} className={cn("size-16 overflow-hidden rounded-md border-2", i === index ? "border-primary" : "border-transparent opacity-70")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemImageUrl(image, "thumb") ?? ""} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <Sheet open={viewer} onClose={() => setViewer(false)} size="lg" title={title}>
        <div className="space-y-3">
          {images.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={image.path} src={itemImageUrl(image, "full") ?? ""} alt="" className="w-full rounded-xl bg-surface-2" />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
