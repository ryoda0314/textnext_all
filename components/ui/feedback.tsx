"use client";

import { AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Sheet } from "./sheet";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };
type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type FeedbackApi = {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

/** Toasts and confirmation dialogs, available anywhere via useFeedback(). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), tone === "error" ? 5000 : 3200);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto max-w-md animate-sheet-up rounded-lg px-4 py-2.5 text-sm font-medium leading-snug shadow-[var(--shadow-float)]",
              t.tone === "error" ? "bg-danger text-white" : "bg-fg text-bg",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
      <Sheet
        open={Boolean(confirmState)}
        onClose={() => close(false)}
        size="sm"
        title={confirmState?.title}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
              {confirmState?.cancelLabel ?? "やめる"}
            </Button>
            <Button variant={confirmState?.danger ? "danger" : "primary"} className="flex-1" onClick={() => close(true)}>
              {confirmState?.confirmLabel ?? "OK"}
            </Button>
          </div>
        }
      >
        {confirmState?.message && (
          <div className="flex gap-3 text-sm leading-relaxed text-muted">
            {confirmState.danger && <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />}
            <div>{confirmState.message}</div>
          </div>
        )}
      </Sheet>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
