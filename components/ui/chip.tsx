import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Toggle tag (filters, choices). */
export function Chip({
  selected,
  className,
  children,
  icon,
  ...props
}: ComponentProps<"button"> & { selected?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
        selected
          ? "border-primary bg-primary-soft font-semibold text-primary-soft-fg"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "dark";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    primary: "bg-primary-soft text-primary-soft-fg",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    dark: "bg-fg text-bg",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold leading-none", tones[tone], className)}>
      {children}
    </span>
  );
}
