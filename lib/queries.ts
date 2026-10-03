import { getSupabase } from "@/lib/supabase/client";
import type { ItemWithSeller } from "@/lib/types";

export const OPEN_TRADE_STATUSES = ["negotiating", "scheduled", "handed_over"] as const;

const ITEM_SELECT =
  "*, seller:profiles!items_seller_id_fkey(id, nickname, avatar_path, faculty, department, grade, rating_good, rating_normal, rating_bad, completed_trades, listings_paused, deleted_at), campus:campuses(name)";

export async function fetchItem(id: string) {
  const { data, error } = await getSupabase().from("items").select(ITEM_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as ItemWithSeller | null;
}

export async function fetchOpenTradeForItem(itemId: string) {
  const { data, error } = await getSupabase()
    .from("trades")
    .select("id, status, buyer_id, seller_id")
    .eq("item_id", itemId)
    .in("status", [...OPEN_TRADE_STATUSES])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchIsFavorite(itemId: string, userId: string) {
  const { count, error } = await getSupabase()
    .from("favorites")
    .select("item_id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
