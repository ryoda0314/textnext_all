"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string; count?: number };

/** Equal-width tabs with an underline (page sections). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex border-b border-border", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "-mb-px flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm transition-colors",
              active ? "border-primary font-semibold text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-accent-fg">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Left-aligned, scrollable text filters. */
export function TextTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-5 overflow-x-auto border-b border-border scrollbar-none", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "-mb-px h-10 shrink-0 border-b-2 text-sm transition-colors",
              active ? "border-primary font-semibold text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
