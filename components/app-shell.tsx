"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Camera, Home, MessagesSquare, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMember } from "@/components/session";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { ServiceWorker } from "@/components/service-worker";

export const badgeKey = ["badges"] as const;

export function useBadges() {
  return useQuery({
    queryKey: badgeKey,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_badge_counts");
      if (error) throw error;
      return data as { notifications: number; trades: number };
    },
    refetchInterval: 90_000,
    staleTime: 15_000,
  });
}

/** Keeps badges, trade lists and notifications fresh while the app is open. */
function useLiveUpdates(userId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`member:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: badgeKey });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, (payload) => {
        queryClient.invalidateQueries({ queryKey: badgeKey });
        queryClient.invalidateQueries({ queryKey: ["my-trades"] });
        const id = (payload.new as { id?: string } | null)?.id;
        if (id) queryClient.invalidateQueries({ queryKey: ["trade", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

const NAV = [
  { href: "/", label: "ホーム", icon: Home, match: (p: string) => p === "/" },
  { href: "/search", label: "さがす", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/sell", label: "出品", icon: Camera, match: (p: string) => p.startsWith("/sell") },
  { href: "/trades", label: "取引", icon: MessagesSquare, match: (p: string) => p.startsWith("/trades") },
  { href: "/me", label: "マイページ", icon: User, match: (p: string) => p.startsWith("/me") || p.startsWith("/settings") },
] as const;

/** Routes that take over the whole screen on phones (they bring their own bottom action bar). */
const IMMERSIVE = [/^\/trades\/[^/]+$/, /^\/sell/, /^\/items\/[^/]+(\/edit)?$/];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, university, userId } = useMember();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { data: badges } = useBadges();
  const [query, setQuery] = useState("");
  useLiveUpdates(userId);

  const immersive = IMMERSIVE.some((re) => re.test(pathname));
  const universityLabel = university.short_name ?? university.name;

  return (
    <div className="min-h-dvh">
      <ServiceWorker />
      {/* Desktop header */}
      <header className="fixed inset-x-0 top-0 z-40 hidden h-16 border-b border-border bg-bg/95 backdrop-blur lg:block">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-5 px-6">
          <Link href="/" className="flex items-baseline gap-3">
            <Logo />
            <span className="border-l border-border pl-3 text-sm text-muted">{universityLabel}</span>
          </Link>
          <form
            className="relative ml-4 max-w-md flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search");
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="書名・著者・授業名・ISBNで検索"
              className="h-10 w-full rounded-lg border border-transparent bg-surface-2 pl-9 pr-4 text-sm focus:border-primary focus:bg-surface focus:outline-none"
              style={{ fontSize: 14 }}
            />
          </form>
          <nav className="ml-auto flex items-center gap-1">
            <DesktopLink href="/" active={pathname === "/"}>ホーム</DesktopLink>
            <DesktopLink href="/trades" active={pathname.startsWith("/trades")} badge={badges?.trades}>
              取引
            </DesktopLink>
            <Link href="/notifications" className="relative grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label="お知らせ">
              <Bell className="size-5" strokeWidth={1.75} />
              <CountBadge count={badges?.notifications} className="right-1 top-1" />
            </Link>
            <Link href="/sell" className="ml-3 inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg hover:brightness-95">
              <Camera className="size-4" />
              出品する
            </Link>
            <Link href="/me" className="ml-2 rounded-full" aria-label="マイページ">
              <Avatar path={profile.avatar_path} name={profile.nickname} seed={profile.id} size={34} />
            </Link>
          </nav>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-6xl lg:px-6 lg:pt-16", immersive ? "pb-0" : "pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-10")}>
        {children}
      </main>

      {/* Mobile tab bar */}
      {!immersive && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-safe backdrop-blur lg:hidden" aria-label="メインメニュー">
          <div className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-5">
            {NAV.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              if (item.href === "/sell") {
                return (
                  <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center gap-0.5" aria-label="出品する">
                    <span className="grid h-8 w-11 place-items-center rounded-lg bg-accent text-accent-fg">
                      <Camera className="size-[18px]" strokeWidth={2} />
                    </span>
                    <span className="text-[10px] font-medium text-muted">{item.label}</span>
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex flex-col items-center justify-center gap-1 text-[10px]", active ? "font-semibold text-primary" : "text-subtle")}
                >
                  <span className="relative">
                    <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.6} />
                    {item.href === "/trades" && <CountBadge count={badges?.trades} className="-right-2.5 -top-1.5" />}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function DesktopLink({ href, active, badge, children }: { href: string; active: boolean; badge?: number; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("relative inline-flex h-10 items-center rounded-lg px-3.5 text-sm", active ? "font-semibold text-fg" : "text-muted hover:text-fg")}
    >
      {children}
      {active && <span className="absolute inset-x-3.5 -bottom-[13px] h-0.5 bg-primary" aria-hidden />}
      <CountBadge count={badge} className="-right-1 top-0.5" />
    </Link>
  );
}

export function CountBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("tabular absolute grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-fg ring-2 ring-bg", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Wordmark in TextNext blue (the original used the same blue, as a gradient). */
export function Logo({ className }: { className?: string }) {
  return <span className={cn("text-[21px] font-bold leading-none tracking-tight text-primary", className)}>TextNext</span>;
}
