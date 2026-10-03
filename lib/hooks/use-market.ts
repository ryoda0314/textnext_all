"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";

export type FeedSort = "new" | "price_asc" | "price_desc" | "popular";
export type FeedFilters = {
  query?: string;
  campusId?: string | null;
  faculty?: string | null;
  freeOnly?: boolean;
  includeReserved?: boolean;
  sort?: FeedSort;
};

const PAGE_SIZE = 24;

export function useMarketFeed(filters: FeedFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["market", filters],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabase().rpc("search_items", {
        p_query: filters.query?.trim() || undefined,
        p_campus_id: filters.campusId || undefined,
        p_faculty: filters.faculty || undefined,
        p_free_only: filters.freeOnly ?? false,
        p_include_reserved: filters.includeReserved ?? true,
        p_sort: filters.sort ?? "new",
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last, pages) => (last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });
}
