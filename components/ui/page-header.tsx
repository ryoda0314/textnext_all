"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Sticky title bar for inner pages. `back` is the fallback destination when there is no history. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border bg-bg/95 pt-safe backdrop-blur lg:top-16",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-1 px-2">
        {back !== undefined && (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(back))}
            className="grid size-10 shrink-0 place-items-center rounded-full text-fg hover:bg-surface-2"
            aria-label="戻る"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <div className={cn("min-w-0 flex-1", back === undefined && "pl-3")}>
          {title && <h1 className="truncate text-base font-bold leading-tight">{title}</h1>}
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
