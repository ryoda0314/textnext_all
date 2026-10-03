"use client";

import QRCode from "qrcode";
import { RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeInput } from "@/components/auth-inputs";
import { CameraScanner } from "@/components/camera-scanner";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";
import { Notice } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { APP_URL } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Seller: shows a short-lived QR + 6-digit code for the buyer to scan/enter. */
export function ShowCodeSheet({ open, onClose, tradeId, handedOver }: { open: boolean; onClose: () => void; tradeId: string; handedOver: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [now, setNow] = useState(() => Date.now());
  useWakeLock(open);

  // Each fetch issues a fresh code; it is re-issued automatically when it expires.
  const codeQuery = useQuery({
    queryKey: ["handover-code", tradeId],
    enabled: open && !handedOver,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("issue_handover_code", { p_trade_id: tradeId });
      if (error) throw error;
      const result = data as { code: string; expires_at: string };
      const qr = await QRCode.toDataURL(`${APP_URL}/trades/${tradeId}?code=${result.code}`, { margin: 1, width: 520, errorCorrectionLevel: "M" });
      return { ...result, qr };
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data ? Math.max(1000, new Date(data.expires_at).getTime() - Date.now()) : false;
    },
  });

  const close = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["handover-code", tradeId] });
    onClose();
  }, [queryClient, tradeId, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (open && codeQuery.error) {
      toast(errorMessage(codeQuery.error), "error");
      close();
    }
  }, [open, codeQuery.error, toast, close]);

  useEffect(() => {
    if (open && handedOver) {
      toast("受け渡しが完了しました！");
      close();
    }
  }, [open, handedOver, toast, close]);

  const code = codeQuery.data;
  const remaining = code ? Math.min(600, Math.max(0, Math.round((new Date(code.expires_at).getTime() - now) / 1000))) : 0;

  return (
    <Sheet open={open} onClose={close} title="受け渡しコード" description="商品を渡したら、購入者にQRを読み取ってもらうか、6桁のコードを入力してもらいます。">
      <div className="flex flex-col items-center gap-4 pb-2 pt-2">
        <div className="grid size-64 place-items-center rounded-3xl bg-white p-3 shadow-[var(--shadow-card)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {code ? <img src={code.qr} alt="受け渡し用QRコード" className="size-full" /> : <Spinner className="text-slate-400" />}
        </div>
        <p className="tabular text-4xl font-bold tracking-[0.3em]" aria-label={`コード ${code?.code ?? ""}`}>
          {code ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : "--- ---"}
        </p>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="tabular">有効期限 {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
          <button type="button" onClick={() => codeQuery.refetch()} disabled={codeQuery.isFetching} className="inline-flex items-center gap-1 font-bold text-primary disabled:opacity-50">
            <RefreshCw className="size-3.5" />
            更新
          </button>
        </div>
        <Notice className="w-full text-center text-xs">購入者が入力すると、この画面は自動で閉じます。代金の受け取りもお忘れなく。</Notice>
      </div>
    </Sheet>
  );
}

function extractCode(raw: string, tradeId: string) {
  const digits = raw.trim();
  if (/^\d{6}$/.test(digits)) return digits;
  try {
    const url = new URL(raw);
    if (!url.pathname.endsWith(`/trades/${tradeId}`)) return null;
    const code = url.searchParams.get("code") ?? "";
    return /^\d{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Buyer: scan the seller's QR or type the code to record the hand-over. */
export function ReceiveSheet({
  open,
  onClose,
  tradeId,
  initialCode,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeId: string;
  initialCode?: string | null;
  onDone: () => void;
}) {
  const { toast } = useFeedback();
  const [mode, setMode] = useState<"scan" | "type">(initialCode ? "type" : "scan");
  const [code, setCode] = useState(initialCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmitted = useRef(false);

  const submit = useCallback(
    async (value: string) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      const { data, error: rpcError } = await getSupabase().rpc("complete_handover", { p_trade_id: tradeId, p_code: value });
      setSubmitting(false);
      if (rpcError) {
        setError(errorMessage(rpcError));
        return;
      }
      const result = data as { ok: boolean; error?: string; remaining?: number };
      if (result.ok) {
        toast("受け渡しが完了しました！取引相手を評価しましょう");
        onDone();
        onClose();
        return;
      }
      setCode("");
      setMode("type");
      setError(
        result.error === "invalid_code"
          ? `コードが違います（あと${result.remaining ?? 0}回）`
          : result.error === "too_many_attempts"
            ? "入力回数の上限に達しました。出品者に新しいコードを表示してもらってください"
            : "コードの有効期限が切れています。出品者に新しいコードを表示してもらってください",
      );
    },
    [submitting, tradeId, toast, onDone, onClose],
  );

  useEffect(() => {
    if (open && initialCode && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(initialCode);
    }
  }, [open, initialCode, submit]);

  return (
    <Sheet open={open} onClose={onClose} title="商品を受け取る" description="商品を確認してから、出品者の画面のQRを読み取るかコードを入力してください。">
      <div className="space-y-4 pt-1">
        <Tabs value={mode} onChange={setMode} options={[{ value: "scan", label: "QRを読み取る" }, { value: "type", label: "コードを入力" }]} />
        {mode === "scan" && open ? (
          <CameraScanner
            formats={["qr_code"]}
            hint="出品者の画面のQRコードを枠に合わせてください"
            onDetect={(raw) => {
              const value = extractCode(raw, tradeId);
              if (!value) return false;
              setCode(value);
              submit(value);
              return true;
            }}
          />
        ) : (
          <div className="space-y-3">
            <CodeInput value={code} onChange={setCode} onComplete={submit} disabled={submitting} />
            <Button className="w-full" size="lg" disabled={code.length !== 6} loading={submitting} onClick={() => submit(code)}>
              受け取りを完了する
            </Button>
          </div>
        )}
        {submitting && mode === "scan" && <p className="flex items-center justify-center gap-2 text-sm text-muted"><Spinner className="size-4" />確認中…</p>}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Sheet>
  );
}
