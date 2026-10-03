"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { MyContext } from "@/lib/types";

export const contextKey = ["context"] as const;

async function fetchContext() {
  const { data, error } = await getSupabase().rpc("get_my_context");
  if (error) throw error;
  return data as unknown as MyContext;
}

/** Seeds the query cache with the context the server already loaded. */
export function SessionProvider({ initial, children }: { initial: MyContext; children: ReactNode }) {
  const queryClient = useQueryClient();
  useState(() => {
    queryClient.setQueryData(contextKey, initial);
    return null;
  });
  return children;
}

export function useSession() {
  const { data } = useQuery({ queryKey: contextKey, queryFn: fetchContext, staleTime: 5 * 60_000 });
  if (!data) throw new Error("useSession() used outside of a signed-in page");
  return data;
}

/** For pages under the member layout, where a profile and university are guaranteed. */
export function useMember() {
  const ctx = useSession();
  return { ctx, profile: ctx.profile!, university: ctx.university!, userId: ctx.user_id };
}

export function useRefreshSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: contextKey });
}
