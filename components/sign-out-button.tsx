"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      className={className}
      loading={loading}
      icon={<LogOut className="size-4.5" />}
      onClick={async () => {
        setLoading(true);
        await getSupabase().auth.signOut();
        // Full reload: drops every cached query, realtime channel and server-rendered session at once
        // (clearing the cache in place would re-render member pages without a session first).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/welcome");
      }}
    >
      ログアウト
    </Button>
  );
}
