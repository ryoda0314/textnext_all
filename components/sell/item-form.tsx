"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, ScanBarcode, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CameraScanner, isValidIsbn13 } from "@/components/camera-scanner";
import { useMember } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { cn, orNull } from "@/lib/cn";
import { CONDITIONS, LIMITS, priceCap, WRITING, type Condition, type Writing } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { readLocal } from "@/lib/hooks/use-local-storage";
import { yen } from "@/lib/format";
import { ImageError, itemImageUrl, removeItemImages, uploadItemImage } from "@/lib/images";
import { LISTING_RULES } from "@/lib/legal";
import { getSupabase } from "@/lib/supabase/client";
import { itemImages, type Item, type ItemImage } from "@/lib/types";
import { PhotoPicker, type PhotoEntry } from "./photo-picker";

const DRAFT_KEY = "textnext:sell-draft";
const RULES_KEY = "textnext:listing-rules-accepted";

type Draft = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  courseName: string;
  condition: Condition | "";
  writing: Writing;
  listPrice: string;
  customPrice: string | null;
  description: string;
  campusId: string;
};

const EMPTY: Draft = {
  isbn: "",
  title: "",
  author: "",
  publisher: "",
  courseName: "",
  condition: "",
  writing: "none",
  listPrice: "",
  customPrice: null,
  description: "",
  campusId: "",
};

function fromItem(item: Item, capPercent: number): Draft {
  const cap = priceCap(item.list_price, capPercent);
  return {
    isbn: item.isbn ?? "",
    title: item.title,
    author: item.author ?? "",
    publisher: item.publisher ?? "",
    courseName: item.course_name ?? "",
    condition: item.condition as Condition,
    writing: item.writing as Writing,
    listPrice: String(item.list_price),
    customPrice: item.price === cap ? null : String(item.price),
    description: item.description ?? "",
    campusId: item.campus_id ?? "",
  };
}

export function ItemForm({ item }: { item?: Item }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const { university, profile, userId } = useMember();
  const editing = Boolean(item);

  // Rendered client-only (see ItemFormClient), so the saved draft can seed the initial state.
  const [draft, setDraft] = useState<Draft>(() =>
    item ? fromItem(item, university.price_cap_percent) : { ...EMPTY, campusId: profile.campus_id ?? "", ...readLocal<Partial<Draft>>(DRAFT_KEY, {}) },
  );
  const [photos, setPhotos] = useState<PhotoEntry[]>(() =>
    item ? itemImages(item.images).map((img) => ({ key: img.path, preview: itemImageUrl(img, "thumb")!, stored: img })) : [],
  );
  const [rulesAccepted, setRulesAccepted] = useState(() => editing || readLocal(RULES_KEY, false));
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    if (editing) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, editing]);

  // How many members are waiting for this ISBN?
  const isbnValid = isValidIsbn13(draft.isbn);
  const { data: demandData } = useQuery({
    queryKey: ["wish-demand", draft.isbn],
    enabled: isbnValid,
    queryFn: async () => (await getSupabase().rpc("wish_demand", { p_isbn: draft.isbn })).data ?? 0,
  });
  const demand = isbnValid ? (demandData ?? 0) : 0;

  const listPrice = Number(draft.listPrice);
  const listPriceValid = Number.isInteger(listPrice) && listPrice >= 1 && listPrice <= LIMITS.listPriceMax;
  const cap = listPriceValid ? priceCap(listPrice, university.price_cap_percent) : 0;
  const price = draft.customPrice === null ? cap : Number(draft.customPrice);
  const priceValid = Number.isInteger(price) && price >= 0 && price <= cap;

  const missing = [
    photos.length === 0 && "写真",
    !draft.title.trim() && "書名",
    !draft.condition && "状態",
    !listPriceValid && "定価",
    !priceValid && "販売価格",
    !rulesAccepted && "出品ルールの確認",
  ].filter((m): m is string => Boolean(m));

  async function lookup(isbn = draft.isbn) {
    const code = isbn.replace(/\D/g, "");
    if (!isValidIsbn13(code)) {
      toast("ISBNは978または979から始まる13桁です", "error");
      return;
    }
    setLookingUp(true);
    try {
      const response = await fetch(`/api/books/isbn?isbn=${code}`);
      if (response.status === 404) {
        toast("書籍情報が見つかりませんでした。手入力してください", "info");
        return;
      }
      if (!response.ok) throw new Error();
      const book = (await response.json()) as { title: string; author: string | null; publisher: string | null; listPrice: number | null };
      setDraft((d) => ({
        ...d,
        isbn: code,
        title: book.title || d.title,
        author: book.author ?? d.author,
        publisher: book.publisher ?? d.publisher,
        listPrice: book.listPrice && book.listPrice <= LIMITS.listPriceMax ? String(book.listPrice) : d.listPrice,
      }));
      toast(book.listPrice ? "書名と定価を入力しました" : "書名を入力しました。定価は裏表紙で確認してください");
    } catch {
      toast("書籍情報を取得できませんでした。手入力してください", "error");
    } finally {
      setLookingUp(false);
    }
  }

  async function submit() {
    if (missing.length > 0) return;
    setError(null);
    const uploaded: ItemImage[] = [];
    try {
      const images: ItemImage[] = [];
      const toUpload = photos.filter((p) => p.file).length;
      let done = 0;
      for (const photo of photos) {
        if (photo.stored) {
          images.push(photo.stored);
          continue;
        }
        setProgress(`写真をアップロード中（${++done}/${toUpload}）`);
        const stored = await uploadItemImage(photo.file!, university.id, userId);
        uploaded.push(stored);
        images.push(stored);
      }
      setProgress(editing ? "保存中" : "出品中");

      const fields = {
        title: draft.title.trim(),
        author: orNull(draft.author.trim() || null),
        publisher: orNull(draft.publisher.trim() || null),
        isbn: orNull(draft.isbn.replace(/\D/g, "") || null),
        course_name: orNull(draft.courseName.trim() || null),
        description: orNull(draft.description.trim() || null),
        condition: draft.condition as Condition,
        writing: draft.writing,
        list_price: listPrice,
        price,
        images,
        campus_id: orNull(draft.campusId || null),
      };

      const supabase = getSupabase();
      let itemId = item?.id;
      if (editing) {
        const { error: updateError } = await supabase.from("items").update(fields).eq("id", item!.id);
        if (updateError) throw updateError;
        const kept = new Set(images.flatMap((i) => [i.path, i.thumb]));
        const removed = itemImages(item!.images).flatMap((i) => [i.path, i.thumb]).filter((p): p is string => Boolean(p) && !kept.has(p));
        removeItemImages(removed).catch(() => undefined);
      } else {
        const { data, error: insertError } = await supabase.from("items").insert(fields).select("id").single();
        if (insertError) throw insertError;
        itemId = data.id;
        try {
          localStorage.removeItem(DRAFT_KEY);
          localStorage.setItem(RULES_KEY, "true");
        } catch {}
      }

      queryClient.invalidateQueries({ queryKey: ["market"] });
      queryClient.invalidateQueries({ queryKey: ["my-items"] });
      queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      toast(editing ? "変更を保存しました" : "出品しました！");
      router.replace(`/items/${itemId}`);
    } catch (e) {
      removeItemImages(uploaded.flatMap((i) => [i.path, i.thumb!].filter(Boolean))).catch(() => undefined);
      setError(e instanceof ImageError ? e.message : errorMessage(e));
      setProgress(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 lg:px-0 lg:pb-16">
      <section className="space-y-3">
        <h2 className="text-sm font-bold">写真 <span className="text-xs text-accent">必須</span></h2>
        <PhotoPicker value={photos} onChange={setPhotos} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold">本の情報</h2>
        <Field label="ISBN" htmlFor="isbn" hint="裏表紙のバーコードを読み取ると、書名と定価を自動で入力します">
          <div className="flex gap-2">
            <Input
              id="isbn"
              inputMode="numeric"
              value={draft.isbn}
              onChange={(e) => set("isbn", e.target.value.replace(/[^\d-]/g, "").slice(0, 17))}
              placeholder="978から始まる13桁"
              className="tabular"
            />
            <Button variant="secondary" className="h-12 shrink-0 px-3" onClick={() => lookup()} disabled={lookingUp || draft.isbn.replace(/\D/g, "").length !== 13} aria-label="ISBNで検索">
              {lookingUp ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
            </Button>
            <Button className="h-12 shrink-0 px-3.5" onClick={() => setScanning(true)} icon={<ScanBarcode className="size-5" />}>
              <span className="hidden sm:inline">読み取る</span>
            </Button>
          </div>
        </Field>

        {demand > 0 && (
          <Notice tone="success" className="flex items-center gap-2">
            <BellRing className="size-4.5 shrink-0" />
            <span>この本を探している人が<b>{demand}人</b>います。出品するとお知らせが届きます。</span>
          </Notice>
        )}

        <Field label="書名" htmlFor="title" required counter={{ value: draft.title.length, max: LIMITS.titleMax }}>
          <Input id="title" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={LIMITS.titleMax} placeholder="例: 線形代数入門" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="著者" htmlFor="author">
            <Input id="author" value={draft.author} onChange={(e) => set("author", e.target.value)} maxLength={LIMITS.authorMax} />
          </Field>
          <Field label="出版社" htmlFor="publisher">
            <Input id="publisher" value={draft.publisher} onChange={(e) => set("publisher", e.target.value)} maxLength={LIMITS.publisherMax} />
          </Field>
        </div>
        <Field label="使った授業" htmlFor="course" hint="授業名で探している人に見つかりやすくなります">
          <Input id="course" value={draft.courseName} onChange={(e) => set("courseName", e.target.value)} maxLength={LIMITS.courseMax} placeholder="例: 線形代数学第一（任意）" />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold">状態 <span className="text-xs text-accent">必須</span></h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CONDITIONS) as Condition[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={draft.condition === c}
              onClick={() => set("condition", c)}
              className={cn(
                "rounded-xl border px-3.5 py-3 text-left transition-colors",
                draft.condition === c ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <p className={cn("text-sm font-bold", draft.condition === c && "text-primary-soft-fg")}>{CONDITIONS[c].label}</p>
              <p className="mt-0.5 text-xs text-muted">{CONDITIONS[c].hint}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WRITING) as Writing[]).map((w) => (
            <Chip key={w} selected={draft.writing === w} onClick={() => set("writing", w)}>{WRITING[w].label}</Chip>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold">価格</h2>
        <Field label="定価（税込）" htmlFor="list-price" required hint="裏表紙やカバーに書かれている定価です（5万円まで）">
          <div className="relative">
            <Input id="list-price" inputMode="numeric" value={draft.listPrice} onChange={(e) => set("listPrice", e.target.value.replace(/\D/g, "").slice(0, 5))} className="tabular pr-10" placeholder="3000" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">円</span>
          </div>
        </Field>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-muted">販売価格</p>
              <p className="tabular mt-1 text-3xl font-bold leading-none">{listPriceValid ? yen(price) : "—"}</p>
            </div>
            <p className="pb-1 text-right text-xs leading-relaxed text-muted">
              上限は定価の{university.price_cap_percent}%<br />（10円未満切り捨て）
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip selected={draft.customPrice === null} onClick={() => set("customPrice", null)}>上限価格{listPriceValid ? `（${yen(cap)}）` : ""}</Chip>
            <Chip selected={draft.customPrice !== null && draft.customPrice !== "0"} onClick={() => set("customPrice", String(Math.floor(cap / 20) * 10))}>値下げする</Chip>
            <Chip selected={draft.customPrice === "0"} onClick={() => set("customPrice", "0")}>無料でゆずる</Chip>
          </div>
          {draft.customPrice !== null && draft.customPrice !== "0" && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={cap}
                step={10}
                value={Math.min(Number(draft.customPrice) || 0, cap)}
                onChange={(e) => set("customPrice", e.target.value)}
                className="flex-1 accent-[var(--primary)]"
                aria-label="販売価格"
              />
              <div className="relative w-28">
                <Input inputMode="numeric" value={draft.customPrice} onChange={(e) => set("customPrice", e.target.value.replace(/\D/g, "").slice(0, 5))} className="tabular h-10 pr-8 text-right" aria-label="販売価格（円）" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">円</span>
              </div>
            </div>
          )}
          {listPriceValid && !priceValid && <p className="mt-2 text-xs font-bold text-danger">販売価格は{yen(cap)}以下にしてください</p>}
        </div>
      </section>

      <section className="space-y-4">
        <Field label="説明" htmlFor="description" counter={{ value: draft.description.length, max: LIMITS.descriptionMax }}>
          <Textarea id="description" value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={LIMITS.descriptionMax} rows={4}
            placeholder="例: 2025年度の授業で使用。マーカーが数ページあります。付属のCDはありません。" />
        </Field>
        {university.campuses.length > 0 && (
          <Field label="受け渡しするキャンパス" htmlFor="campus">
            <Select id="campus" value={draft.campusId} onChange={(e) => set("campusId", e.target.value)}>
              <option value="">指定しない</option>
              {university.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
      </section>

      {!editing && (
        <section className="space-y-3 border-y border-border py-4">
          <h2 className="text-sm font-semibold">出品のルール
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted">
            {LISTING_RULES.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm font-bold">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={rulesAccepted} onChange={(e) => setRulesAccepted(e.target.checked)} />
            ルールを確認しました
          </label>
        </section>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto max-w-2xl">
          {missing.length > 0 && <p className="mb-2 text-center text-xs text-muted">未入力: {missing.join("・")}</p>}
          <Button size="lg" variant="accent" className="w-full" disabled={missing.length > 0 || Boolean(progress)} loading={Boolean(progress)} onClick={submit}>
            {progress ?? (editing ? "変更を保存" : "出品する")}
          </Button>
        </div>
      </div>

      <Sheet open={scanning} onClose={() => setScanning(false)} title="バーコードを読み取る" description="裏表紙の上段のバーコード（978…）を枠に合わせてください">
        {scanning && (
          <CameraScanner
            formats={["ean_13"]}
            hint="978/979で始まるバーコード"
            onDetect={(code) => {
              if (!isValidIsbn13(code)) return false;
              setScanning(false);
              set("isbn", code);
              lookup(code);
              return true;
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
