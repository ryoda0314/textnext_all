import { BookOpen } from "lucide-react";
import Link from "next/link";
import { CONDITIONS, type Condition } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { yen } from "@/lib/format";
import { itemImageUrl } from "@/lib/images";
import { itemImages } from "@/lib/types";

export type CardItem = {
  id: string | null;
  title: string | null;
  price: number | null;
  images: unknown;
  status: string | null;
  condition?: string | null;
  campus_name?: string | null;
  course_name?: string | null;
  favorite_count?: number | null;
};

export function ItemCard({ item, priority = false }: { item: CardItem; priority?: boolean }) {
  const image = itemImages(item.images)[0];
  const src = itemImageUrl(image, "thumb");
  const reserved = item.status === "reserved";
  const sold = item.status === "sold";
  const condition = item.condition ? CONDITIONS[item.condition as Condition]?.label : null;
  const free = item.price === 0;

  return (
    <Link href={`/items/${item.id}`} className="group block min-w-0 focus-visible:outline-offset-4">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-surface-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className={cn("size-full object-cover transition-opacity group-hover:opacity-90", (reserved || sold) && "opacity-55")}
          />
        ) : (
          <div className="grid size-full place-items-center text-subtle">
            <BookOpen className="size-7" strokeWidth={1.5} />
          </div>
        )}
        {(reserved || sold) && (
          <span className="absolute left-0 top-2 bg-fg px-2 py-1 text-[11px] font-semibold leading-none text-bg">{sold ? "SOLD" : "取引中"}</span>
        )}
      </div>
      <div className="pt-2">
        <p className={cn("tabular text-base font-bold leading-tight", free && "text-accent")}>{yen(item.price ?? 0)}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug">{item.title}</p>
        <p className="mt-1 truncate text-[11px] text-muted">{[condition, item.course_name ?? item.campus_name].filter(Boolean).join("・")}</p>
      </div>
    </Link>
  );
}

export function ItemGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5", className)}>{children}</div>;
}

export function ItemGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ItemGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-[3/4] animate-shimmer rounded-md bg-surface-2" />
          <div className="mt-2 h-4 w-14 animate-shimmer rounded bg-surface-2" />
          <div className="mt-2 h-3.5 w-full animate-shimmer rounded bg-surface-2" />
        </div>
      ))}
    </ItemGrid>
  );
}
