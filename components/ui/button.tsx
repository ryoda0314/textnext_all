import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "danger-soft";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  accent: "bg-accent text-accent-fg hover:brightness-95",
  secondary: "bg-surface-2 text-fg hover:bg-surface-3",
  outline: "border border-border-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-soft": "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-[15px]",
  icon: "size-10 rounded-full",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner className="size-4" label="処理中" /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
