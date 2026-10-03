"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { badgeKey } from "@/components/app-shell";
import { getSupabase } from "@/lib/supabase/client";
import type { Message, Trade } from "@/lib/types";

export function useTrade(id: string, userId: string) {
  const queryClient = useQueryClient();
  const supabase = getSupabase();

  const trade = useQuery({
    queryKey: ["trade", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("trades").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Trade | null;
    },
  });

  const counterpartId = trade.data ? (trade.data.buyer_id === userId ? trade.data.seller_id : trade.data.buyer_id) : null;

  const counterpart = useQuery({
    queryKey: ["profile", counterpartId],
    enabled: Boolean(counterpartId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_path, faculty, grade, rating_good, rating_normal, rating_bad, completed_trades, deleted_at")
        .eq("id", counterpartId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("trade_id", id).order("created_at", { ascending: true }).limit(1000);
      if (error) throw error;
      return data as Message[];
    },
  });

  const ratings = useQuery({
    queryKey: ["trade-ratings", id, trade.data?.status],
    enabled: Boolean(trade.data && ["handed_over", "completed"].includes(trade.data.status)),
    queryFn: async () => {
      const { data, error } = await supabase.from("ratings").select("rater_id, ratee_id, score, comment, created_at").eq("trade_id", id);
      if (error) throw error;
      return data;
    },
  });

  // Live updates for this conversation.
  useEffect(() => {
    const channel = supabase
      .channel(`trade:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `trade_id=eq.${id}` }, (payload) => {
        const message = payload.new as Message;
        queryClient.setQueryData<Message[]>(["messages", id], (old) =>
          old ? (old.some((m) => m.id === message.id) ? old : [...old, message]) : [message],
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trades", filter: `id=eq.${id}` }, (payload) => {
        queryClient.setQueryData<Trade | null>(["trade", id], (old) => (old ? { ...old, ...(payload.new as Trade) } : (payload.new as Trade)));
        queryClient.invalidateQueries({ queryKey: ["trade-ratings", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient, supabase]);

  // Mark as read whenever new messages arrive while the page is visible.
  const lastRead = useRef<string | null>(null);
  const latest = messages.data?.at(-1)?.id ?? null;
  useEffect(() => {
    if (!latest || latest === lastRead.current) return;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      lastRead.current = latest;
      supabase.rpc("mark_trade_read", { p_trade_id: id }).then(() => {
        queryClient.invalidateQueries({ queryKey: badgeKey });
        queryClient.invalidateQueries({ queryKey: ["my-trades"] });
      });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [latest, id, queryClient, supabase]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trade", id] });
    queryClient.invalidateQueries({ queryKey: ["messages", id] });
    queryClient.invalidateQueries({ queryKey: ["trade-ratings", id] });
    queryClient.invalidateQueries({ queryKey: ["my-trades"] });
    queryClient.invalidateQueries({ queryKey: badgeKey });
  };

  return { trade, counterpart, messages, ratings, refresh };
}
