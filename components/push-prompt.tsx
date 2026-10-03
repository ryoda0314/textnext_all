"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { enablePush, getPushState, type PushState } from "@/lib/push";

const DISMISS_KEY = "textnext:push-prompt-dismissed";

/** Nudges members to turn on notifications so trade messages are not missed. */
export function PushPrompt() {
  const { toast } = useFeedback();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    getPushState().then(setState);
  }, []);

  if (state !== "off" && state !== "needs-install") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setState(null);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border px-3.5 py-3">
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {state === "needs-install" ? (
          <p>
            <span className="font-semibold">取引の連絡を通知で受け取るには</span>
            <span className="text-muted">、共有ボタン<Share className="mx-0.5 inline size-3.5 align-[-2px]" />から「ホーム画面に追加」してアプリとして開いてください。</span>
          </p>
        ) : (
          <p>
            <span className="font-semibold">通知をオンにしませんか。</span>
            <span className="text-muted">メッセージや日時の確定をすぐにお知らせします。</span>
          </p>
        )}
        {state === "off" && (
          <Button
            size="sm"
            className="mt-2.5"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const next = await enablePush();
                if (next === "on") {
                  toast("通知をオンにしました");
                  dismiss();
                } else if (next === "denied") {
                  toast("ブラウザの設定で通知が拒否されています", "error");
                }
                setState(next === "on" ? null : next);
              } catch {
                toast("通知を設定できませんでした", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            オンにする
          </Button>
        )}
      </div>
      <button type="button" onClick={dismiss} className="-mr-1 -mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2" aria-label="閉じる">
        <X className="size-4" />
      </button>
    </div>
  );
}
