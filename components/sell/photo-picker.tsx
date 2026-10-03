"use client";

import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/constants";
import type { ItemImage } from "@/lib/types";

export type PhotoEntry = {
  key: string;
  preview: string;
  file?: File;
  stored?: ItemImage;
};

const SLOT_HINTS = ["表紙", "裏表紙", "中身", "傷・書き込み"];

export function PhotoPicker({ value, onChange }: { value: PhotoEntry[]; onChange: (value: PhotoEntry[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (files: FileList | null) => {
    if (!files) return;
    const room = LIMITS.imagesMax - value.length;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .slice(0, room)
      .map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    onChange([...value, ...next]);
  };

  const move = (index: number, delta: number) => {
    const next = [...value];
    const [entry] = next.splice(index, 1);
    next.splice(index + delta, 0, entry);
    onChange(next);
  };

  const remove = (index: number) => {
    const entry = value[index];
    if (entry.file) URL.revokeObjectURL(entry.preview);
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: LIMITS.imagesMax }, (_, i) => {
          const entry = value[i];
          if (!entry) {
            const isNext = i === value.length;
            return (
              <button
                key={`empty-${i}`}
                type="button"
                disabled={!isNext}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-[11px] font-bold",
                  isNext ? "border-primary/50 bg-primary-soft/50 text-primary" : "border-border text-subtle",
                )}
              >
                {isNext && <ImagePlus className="size-6" />}
                {SLOT_HINTS[i]}
              </button>
            );
          }
          return (
            <div key={entry.key} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.preview} alt="" className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">表紙</span>}
              <button type="button" onClick={() => remove(i)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white" aria-label="写真を削除">
                <X className="size-3.5" />
              </button>
              {value.length > 1 && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-6 place-items-center rounded-full bg-black/55 text-white disabled:invisible" aria-label="前へ">
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid size-6 place-items-center rounded-full bg-black/55 text-white disabled:invisible" aria-label="後ろへ">
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs leading-relaxed text-muted">
        表紙は必須です。裏表紙（定価・ISBNが写る面）や書き込みの様子もあると安心されます。名前・学籍番号が写らないよう注意してください。
      </p>
    </div>
  );
}
