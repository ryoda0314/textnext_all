"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { FeedbackProvider } from "@/components/ui/feedback";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>{children}</FeedbackProvider>
    </QueryClientProvider>
  );
}
