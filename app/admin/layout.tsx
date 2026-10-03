import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AdminShell } from "./admin-shell";

export const metadata: Metadata = { title: "管理", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  // Hide the console's existence from everyone else.
  if (!isAdmin) notFound();
  return <AdminShell>{children}</AdminShell>;
}
