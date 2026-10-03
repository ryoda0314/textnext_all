import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { RestrictedScreen } from "@/components/restricted-screen";
import { SessionProvider } from "@/components/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { MyContext } from "@/lib/types";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("get_my_context");
  const ctx = data as unknown as MyContext | null;

  if (!ctx) redirect("/login");
  if (!ctx.profile || ctx.profile.deleted_at || !ctx.university) {
    redirect(ctx.is_admin && !ctx.university ? "/admin" : "/onboarding");
  }

  return (
    <SessionProvider initial={ctx}>
      {ctx.restriction ? <RestrictedScreen restriction={ctx.restriction} /> : <AppShell>{children}</AppShell>}
    </SessionProvider>
  );
}
