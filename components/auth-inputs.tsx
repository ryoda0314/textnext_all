"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-subtle hover:text-fg"
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

/** One input for the whole code: works with SMS/email autofill and paste. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  length = 6,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  length?: number;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={`${length}桁のコード`}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden>
        {Array.from({ length }, (_, i) => {
          const filled = value[i];
          const active = i === Math.min(value.length, length - 1);
          return (
            <div
              key={i}
              className={cn(
                "tabular grid h-14 place-items-center rounded-xl border-2 bg-surface text-2xl font-bold transition-colors",
                active && !disabled ? "border-primary" : "border-border",
                filled ? "text-fg" : "text-subtle",
              )}
            >
              {filled ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
