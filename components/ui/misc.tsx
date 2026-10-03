import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md bg-surface-2", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 text-subtle [&>svg]:size-7 [&>svg]:stroke-[1.5]">{icon}</div>}
      <p className="phrase text-base font-semibold">{title}</p>
      {description && <p className="phrase mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-border bg-surface", className)}>{children}</div>;
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/** Inline note with a coloured rule on the left — quieter than a filled box. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-primary",
    warning: "border-warning",
    danger: "border-danger text-danger",
    success: "border-success",
  } as const;
  return (
    <div className={cn("rounded-r-md border-l-[3px] bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed", tones[tone], className)}>{children}</div>
  );
}
