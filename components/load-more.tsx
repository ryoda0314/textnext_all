"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";

/** Calls onLoad when scrolled into view (infinite scroll), with a button as a fallback. */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) onLoad();
    }, { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoad]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex justify-center py-8">
      {loading ? (
        <Spinner className="text-subtle" />
      ) : (
        <button type="button" onClick={onLoad} className="rounded-full px-4 py-2 text-sm font-bold text-primary hover:bg-primary-soft">
          もっと見る
        </button>
      )}
    </div>
  );
}
