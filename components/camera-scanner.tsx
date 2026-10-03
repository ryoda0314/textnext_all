"use client";

import { CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

type Format = "ean_13" | "qr_code";

let zxingPrepared = false;

async function createDetector(formats: Format[]) {
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  if (!zxingPrepared) {
    // Served from /public so scanning works without a third-party CDN.
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path) },
    });
    zxingPrepared = true;
  }
  return new BarcodeDetector({ formats });
}

/**
 * Live camera scanner. `onDetect` returns true to accept a value (scanning stops),
 * false to keep scanning (e.g. the price barcode under an ISBN).
 */
export function CameraScanner({ formats, onDetect, hint }: { formats: Format[]; onDetect: (value: string) => boolean; hint?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const formatsKey = formats.join(",");

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector(formatsKey.split(",") as Format[]);
        setReady(true);

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              for (const code of codes) {
                if (onDetectRef.current(code.rawValue)) {
                  stopped = true;
                  navigator.vibrate?.(40);
                  return;
                }
              }
            }
          } catch {
            // frame not ready; keep going
          }
          timer = window.setTimeout(tick, 200);
        };
        tick();
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "カメラの使用が許可されていません。ブラウザの設定でカメラを許可してください。"
            : name === "NotFoundError"
              ? "カメラが見つかりませんでした。"
              : "カメラを起動できませんでした。手入力してください。",
        );
      }
    })();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [formatsKey]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-2 px-6 py-10 text-center">
        <CameraOff className="size-8 text-subtle" />
        <p className="text-sm leading-relaxed text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className={formats.includes("qr_code") ? "size-[58%] rounded-3xl border-4 border-white/85" : "h-[34%] w-[78%] rounded-2xl border-4 border-white/85"} />
      </div>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-white">
          <Spinner className="size-7" />
        </div>
      )}
      {hint && <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-center text-sm font-bold text-white">{hint}</p>}
    </div>
  );
}

export function isValidIsbn13(code: string) {
  if (!/^97[89]\d{10}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}
