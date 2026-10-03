"use client";

import { BellPlus, ChevronLeft, Clock, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ItemCard, ItemGrid, ItemGridSkeleton } from "@/components/item-card";
import { LoadMore } from "@/components/load-more";
import { useMember } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { useMarketFeed, type FeedSort } from "@/lib/hooks/use-market";
import { getSupabase } from "@/lib/supabase/client";

const RECENT_KEY = "textnext:recent-searches";
const SORTS: { value: FeedSort; label: string }[] = [
  { value: "new", label: "新着順" },
  { value: "price_asc", label: "安い順" },
  { value: "price_desc", label: "高い順" },
  { value: "popular", label: "いいね順" },
];

function parseRecent(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function asIsbn(query: string) {
  const digits = query.replace(/[^0-9Xx]/g, "");
  return /^97[89]\d{10}$/.test(digits) && !/[^0-9xX\-\s]/.test(query) ? digits : null;
}

export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const { university } = useMember();
  const { toast } = useFeedback();
  const query = params.get("q") ?? "";
  const [draft, setDraft] = useState(query);
  const [sort, setSort] = useState<FeedSort>("new");
  const [freeOnly, setFreeOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [recentRaw, setRecentRaw] = useLocalStorage(RECENT_KEY);
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw]);
  const [wishSaved, setWishSaved] = useState(false);
  const [lastQuery, setLastQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  // A new query in the URL (history navigation, recent search) resets the form.
  if (query !== lastQuery) {
    setLastQuery(query);
    setDraft(query);
    setWishSaved(false);
  }

  const hasQuery = query.trim().length > 0;
  const feed = useMarketFeed({ query, sort, freeOnly, includeReserved: !availableOnly, campusId }, hasQuery || freeOnly || Boolean(campusId));
  const items = feed.data?.pages.flat() ?? [];
  const browsing = hasQuery || freeOnly || Boolean(campusId);

  function submit(value: string) {
    const q = value.trim();
    if (q) setRecentRaw(JSON.stringify([q, ...recent.filter((r) => r !== q)].slice(0, 8)));
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    inputRef.current?.blur();
  }

  async function saveWish() {
    const isbn = asIsbn(query);
    const { error } = await getSupabase()
      .from("wishes")
      .insert(isbn ? { isbn, label: query.trim() } : { keyword: query.trim(), label: query.trim() });
    if (error && !/duplicate|unique/i.test(error.message)) {
      toast(errorMessage(error), "error");
      return;
    }
    setWishSaved(true);
    toast("出品されたらお知らせします");
  }

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-safe backdrop-blur-xl lg:static lg:mt-8 lg:rounded-2xl lg:border">
        <form
          className="flex h-16 items-center gap-2 px-2 lg:px-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          role="search"
        >
          <button type="button" onClick={() => router.back()} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2 lg:hidden" aria-label="戻る">
            <ChevronLeft className="size-6" />
          </button>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-subtle" />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              autoFocus={!query}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="書名・著者・授業名・ISBN"
              className="h-11 w-full rounded-xl bg-surface-2 pl-11 pr-10 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
              aria-label="検索キーワード"
            />
            {draft && (
              <button type="button" onClick={() => { setDraft(""); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-subtle hover:text-fg" aria-label="クリア">
                <X className="size-4.5" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" className="h-11 shrink-0 px-4">検索</Button>
        </form>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as FeedSort)}
            className="h-9 shrink-0 rounded-full border border-border bg-surface px-3 text-sm font-bold text-fg"
            style={{ fontSize: 14 }}
            aria-label="並び替え"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Chip selected={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>購入できるものだけ</Chip>
          <Chip selected={freeOnly} onClick={() => setFreeOnly((v) => !v)}>無料</Chip>
          {university.campuses.length > 1 &&
            university.campuses.map((c) => (
              <Chip key={c.id} selected={campusId === c.id} onClick={() => setCampusId((cur) => (cur === c.id ? null : c.id))}>
                {c.name}
              </Chip>
            ))}
        </div>
      </header>

      <div className="px-4 pt-5 lg:px-0">
        {!browsing ? (
          recent.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted">最近の検索</h2>
                <button type="button" className="text-xs font-bold text-subtle hover:text-fg" onClick={() => setRecentRaw(null)}>
                  履歴を消す
                </button>
              </div>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {recent.map((r) => (
                  <li key={r}>
                    <button type="button" onClick={() => submit(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] hover:bg-surface-2">
                      <Clock className="size-4 text-subtle" />
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <EmptyState icon={<Search />} title="教科書を探す" description="書名・著者名・授業名、または裏表紙のISBN（978から始まる13桁）で検索できます。" />
          )
        ) : feed.isPending ? (
          <ItemGridSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellPlus />}
            title={hasQuery ? `「${query}」はまだ出品されていません` : "条件に合う出品はありません"}
            description={hasQuery ? "入荷通知を登録すると、学内で出品されたときにお知らせします。" : undefined}
            action={
              hasQuery && (
                <Button onClick={saveWish} disabled={wishSaved} icon={<BellPlus className="size-4.5" />}>
                  {wishSaved ? "登録しました" : "入荷通知を受け取る"}
                </Button>
              )
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              {hasQuery && <><b className="text-fg">「{query}」</b>の</>}検索結果
            </p>
            <ItemGrid>
              {items.map((item) => <ItemCard key={item.id} item={item} />)}
            </ItemGrid>
            <LoadMore hasMore={Boolean(feed.hasNextPage)} loading={feed.isFetchingNextPage} onLoad={() => feed.fetchNextPage()} />
            {hasQuery && !feed.hasNextPage && (
              <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-surface-2 p-5 text-center text-sm text-muted">
                探している本が見つからない？
                <Button variant="outline" size="sm" onClick={saveWish} disabled={wishSaved} icon={<BellPlus className="size-4" />}>
                  {wishSaved ? "入荷通知を登録しました" : `「${query}」の入荷通知を受け取る`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
