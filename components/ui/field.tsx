import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-border bg-surface px-3.5 text-fg placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  counter,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  counter?: { value: number; max: number };
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={htmlFor} className="text-sm font-bold text-fg">
            {label}
            {required && <span className="ml-1 text-xs font-bold text-accent">必須</span>}
          </label>
          {counter && (
            <span className={cn("tabular text-xs", counter.value > counter.max ? "text-danger" : "text-subtle")}>
              {counter.value}/{counter.max}
            </span>
          )}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a919e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}
