import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// University library availability via カーリル (calil.jp). Each university sets its
// own system id (universities.calil_system_id); the app key is shared (CALIL_APP_KEY).

type Availability = {
  status: "available" | "checked_out" | "not_owned" | "unknown";
  libraries: { name: string; status: string }[];
  reserveUrl: string | null;
};

const cache = new Map<string, { expires: number; value: Availability }>();
const CACHE_MS = 15 * 60 * 1000;

async function calil(params: Record<string, string>) {
  const url = new URL("https://api.calil.jp/check");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("format", "json");
  url.searchParams.set("callback", "no");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`calil ${response.status}`);
  return response.json();
}

function summarize(entry: { libkey?: Record<string, string>; reserveurl?: string } | null): Availability {
  const libraries = Object.entries(entry?.libkey ?? {}).map(([name, status]) => ({ name, status: String(status) }));
  const available = libraries.some((l) => l.status === "貸出可" || l.status === "蔵書あり" || l.status === "館内のみ");
  const status: Availability["status"] = libraries.length === 0 ? "not_owned" : available ? "available" : "checked_out";
  return { status, libraries, reserveUrl: entry?.reserveurl || null };
}

export async function GET(request: NextRequest) {
  const isbn = (request.nextUrl.searchParams.get("isbn") ?? "").replace(/\D/g, "");
  const appKey = process.env.CALIL_APP_KEY;
  if (!/^97[89]\d{10}$/.test(isbn)) return NextResponse.json({ error: "invalid_isbn" }, { status: 400 });
  if (!appKey) return NextResponse.json({ error: "not_configured" }, { status: 404 });

  const supabase = await createSupabaseServer();
  const { data: universityId } = await supabase.rpc("my_university_id");
  if (!universityId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: university } = await supabase.from("universities").select("calil_system_id").eq("id", universityId).maybeSingle();
  const systemId = university?.calil_system_id;
  if (!systemId) return NextResponse.json({ error: "not_configured" }, { status: 404 });

  const cacheKey = `${systemId}:${isbn}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.value);

  try {
    let payload = await calil({ appkey: appKey, isbn, systemid: systemId });
    for (let i = 0; String(payload?.continue) === "1" && payload.session && i < 8; i++) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      payload = await calil({ appkey: appKey, session: payload.session });
    }
    if (String(payload?.continue) === "1") {
      return NextResponse.json({ status: "unknown", libraries: [], reserveUrl: null } satisfies Availability);
    }
    const value = summarize(payload?.books?.[isbn]?.[systemId] ?? null);
    cache.set(cacheKey, { expires: Date.now() + CACHE_MS, value });
    return NextResponse.json(value);
  } catch {
    return NextResponse.json({ status: "unknown", libraries: [], reserveUrl: null } satisfies Availability);
  }
}
