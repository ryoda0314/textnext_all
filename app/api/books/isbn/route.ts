import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

// Book metadata for the sell form: openBD (Japanese books, includes list price) first,
// Google Books as a fallback. Results are cached in public.book_cache (server-only table).

type Book = { title: string; author: string | null; publisher: string | null; listPrice: number | null; source: string };

const toPrice = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const clean = (value: unknown, max: number) => {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return s ? s.slice(0, max) : null;
};

async function fromOpenBd(isbn: string): Promise<Book | null> {
  const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } });
  if (!response.ok) return null;
  type OpenBdPrice = { PriceAmount?: string | number };
  type OpenBdBook = {
    summary?: { title?: string; author?: string; publisher?: string };
    onix?: { ProductSupply?: { SupplyDetail?: { Price?: OpenBdPrice | OpenBdPrice[] } } };
  } | null;
  const [book] = (await response.json()) as OpenBdBook[];
  if (!book?.summary?.title) return null;
  const priceField = book.onix?.ProductSupply?.SupplyDetail?.Price;
  const price = Array.isArray(priceField) ? priceField[0]?.PriceAmount : priceField?.PriceAmount;
  return {
    title: clean(book.summary.title, 100)!,
    author: clean(String(book.summary.author ?? "").replace(/／著|著$/g, ""), 100),
    publisher: clean(book.summary.publisher, 60),
    listPrice: toPrice(price),
    source: "openbd",
  };
}

async function fromGoogleBooks(isbn: string): Promise<Book | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } });
  if (!response.ok) return null;
  const data = await response.json();
  const info = data?.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  return {
    title: clean([info.title, info.subtitle].filter(Boolean).join(" "), 100)!,
    author: clean((info.authors ?? []).join("、"), 100),
    publisher: clean(info.publisher, 60),
    listPrice: toPrice(data.items[0].saleInfo?.listPrice?.amount),
    source: "google_books",
  };
}

export async function GET(request: NextRequest) {
  const isbn = (request.nextUrl.searchParams.get("isbn") ?? "").replace(/\D/g, "");
  if (!/^97[89]\d{10}$/.test(isbn)) return NextResponse.json({ error: "invalid_isbn" }, { status: 400 });

  // Members only (keeps the endpoint from becoming a free public proxy).
  const supabase = await createSupabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
  try {
    admin = createSupabaseAdmin();
  } catch {
    admin = null;
  }

  if (admin) {
    const { data: cached } = await admin.from("book_cache").select("*").eq("isbn", isbn).maybeSingle();
    if (cached) {
      return NextResponse.json({ title: cached.title, author: cached.author, publisher: cached.publisher, listPrice: cached.list_price, source: cached.source, cached: true });
    }
  }

  try {
    const book = (await fromOpenBd(isbn).catch(() => null)) ?? (await fromGoogleBooks(isbn).catch(() => null));
    if (!book) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (admin) {
      await admin.from("book_cache").upsert({
        isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        list_price: book.listPrice,
        source: book.source,
        fetched_at: new Date().toISOString(),
      });
    }
    return NextResponse.json(book);
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
}
