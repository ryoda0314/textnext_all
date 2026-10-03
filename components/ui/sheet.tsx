"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Modal built on <dialog>: bottom sheet on phones, centred card on larger screens.
 * The browser handles focus trapping, Esc and the backdrop.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClose={() => {
        document.documentElement.style.overflow = "";
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-surface p-0 text-fg shadow-[var(--shadow-float)] open:animate-sheet-up",
        "sm:inset-0 sm:m-auto sm:max-h-[86dvh] sm:rounded-3xl",
        size === "sm" && "sm:max-w-sm",
        size === "md" && "sm:max-w-lg",
        size === "lg" && "sm:max-w-2xl",
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col sm:max-h-[86dvh]">
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-surface-3 sm:hidden" aria-hidden />
          {(title || dismissible) && (
            <div className="flex shrink-0 items-start gap-3 px-5 pb-2 pt-3 sm:pt-5">
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 id={titleId} className="text-[17px] font-bold leading-snug">
                    {title}
                  </h2>
                )}
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-2 -mt-1 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
                  aria-label="閉じる"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-border bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Footer that sticks to the bottom of a Sheet's scrolling body (for forms whose state lives inside the body). */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 border-t border-border bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}
