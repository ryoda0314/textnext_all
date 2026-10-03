"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Library } from "lucide-react";
import { cn } from "@/lib/cn";

type Availability = {
  status: "available" | "checked_out" | "not_owned" | "unknown";
  libraries: { name: string; status: string }[];
  reserveUrl: string | null;
};

const LABELS: Record<Availability["status"], string> = {
  available: "図書館で借りられます",
  checked_out: "図書館にありますが、いまは貸出中です",
  not_owned: "大学図書館には所蔵がありません",
  unknown: "図書館の状況を確認できませんでした",
};

/** "Buy or borrow?" — shows the university library's copy, when the university has a library configured. */
export function LibraryAvailability({ isbn }: { isbn: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["library", isbn],
    queryFn: async () => {
      const response = await fetch(`/api/library?isbn=${isbn}`);
      if (!response.ok) return null;
      return (await response.json()) as Availability;
    },
    staleTime: 10 * 60_000,
  });

  if (!isPending && !data) return null;

  return (
    <section>
      <div className="flex items-start gap-3">
        <Library className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">大学図書館</p>
          {isPending ? (
            <p className="mt-0.5 animate-shimmer text-sm">確認中…</p>
          ) : (
            <p className={cn("mt-0.5 text-sm font-semibold", data!.status === "available" && "text-success")}>{LABELS[data!.status]}</p>
          )}
          {data && data.libraries.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              {data.libraries.map((l) => (
                <li key={l.name}>
                  {l.name}: <span className="text-fg">{l.status}</span>
                </li>
              ))}
            </ul>
          )}
          {data?.reserveUrl && (
            <a href={data.reserveUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2">
              蔵書検索で見る
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
