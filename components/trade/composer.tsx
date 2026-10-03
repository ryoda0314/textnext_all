"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, SendHorizonal } from "lucide-react";
import { useRef, useState } from "react";
import { useFeedback } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { ImageError, uploadChatImage } from "@/lib/images";
import { getSupabase } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

const QUICK_REPLIES = {
  negotiating: ["よろしくお願いします！", "その日程で大丈夫です", "別の日でも大丈夫ですか？"],
  scheduled: ["着きました", "5分ほど遅れます", "どのあたりにいますか？", "目印に〇〇を持っています"],
  handed_over: ["ありがとうございました！", "授業がんばってください！"],
} as const;

export function Composer({ tradeId, status }: { tradeId: string; status: string }) {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quick = QUICK_REPLIES[status as keyof typeof QUICK_REPLIES] ?? [];

  const append = (message: Message) =>
    queryClient.setQueryData<Message[]>(["messages", tradeId], (old) => (old?.some((m) => m.id === message.id) ? old : [...(old ?? []), message]));

  async function send(body: string) {
    const value = body.trim();
    if (!value || sending) return;
    if (value.length > LIMITS.messageMax) {
      toast(`メッセージは${LIMITS.messageMax}文字までです`, "error");
      return;
    }
    setSending(true);
    const { data, error } = await getSupabase().from("messages").insert({ trade_id: tradeId, kind: "text", body: value }).select("*").single();
    setSending(false);
    if (error) {
      toast(errorMessage(error), "error");
      return;
    }
    append(data as Message);
    setText("");
    textareaRef.current?.focus();
  }

  async function sendImage(file: File) {
    setUploading(true);
    try {
      const path = await uploadChatImage(file, tradeId);
      const { data, error } = await getSupabase().from("messages").insert({ trade_id: tradeId, kind: "image", image_path: path }).select("*").single();
      if (error) throw error;
      append(data as Message);
    } catch (e) {
      toast(e instanceof ImageError ? e.message : errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-t border-border bg-bg/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      {quick.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2 scrollbar-none">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} disabled={sending} className="h-8 shrink-0 rounded-md border border-border bg-bg px-3 text-xs text-muted hover:text-fg">
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-end gap-2 px-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="画像を送る">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-6" />}
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            // Desktop: Enter sends, Shift+Enter breaks the line. Phones keep Enter as a line break.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={1}
          placeholder="メッセージを入力"
          aria-label="メッセージ"
          className="max-h-36 min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 leading-relaxed focus:border-primary focus:bg-surface focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-colors", text.trim() ? "bg-primary text-primary-fg" : "bg-surface-2 text-subtle")}
          aria-label="送信"
        >
          {sending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizonal className="size-5" />}
        </button>
      </form>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) sendImage(file);
          e.target.value = "";
        }}
      />
      <p className="px-4 pt-1.5 text-center text-[10px] text-subtle">取引が終わるまで、SNSや電話番号など外部の連絡先は交換しないでください</p>
    </div>
  );
}
