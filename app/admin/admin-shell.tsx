"use client";

import { Building2, Flag, Inbox, LayoutDashboard, MailQuestion, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
  { href: "/admin/universities", label: "大学", icon: Building2 },
  { href: "/admin/users", label: "ユーザー", icon: Users },
  { href: "/admin/reports", label: "通報", icon: Flag },
  { href: "/admin/inquiries", label: "お問い合わせ", icon: Inbox },
  { href: "/admin/requests", label: "大学リクエスト", icon: MailQuestion },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center gap-2 px-4 pt-safe lg:h-16">
          <Logo />
          <span className="rounded-md bg-fg px-1.5 py-0.5 text-[10px] font-bold text-bg">ADMIN</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 scrollbar-none lg:flex-col lg:px-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-bold", active ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-3 pt-4 lg:block">
          <Link href="/" className="block rounded-xl px-3 py-2 text-xs font-bold text-muted hover:bg-surface-2">アプリに戻る</Link>
          <SignOutButton className="mt-2 w-full" />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export function AdminTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold">{children}</h1>
      {action}
    </div>
  );
}

export function AdminCard({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface p-4", className)}>
      {title && <h2 className="mb-3 text-sm font-bold">{title}</h2>}
      {children}
    </section>
  );
}
