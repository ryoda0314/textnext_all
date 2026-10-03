import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { MyContext } from "@/lib/types";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "プロフィール設定" };

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("get_my_context");
  const ctx = data as unknown as MyContext | null;
  if (!ctx) redirect("/login");
  if (ctx.profile && !ctx.profile.deleted_at) redirect("/");
  return <OnboardingForm ctx={ctx} />;
}
