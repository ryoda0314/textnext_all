import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell";
import { buttonClass } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-5">
          <Link href="/" aria-label="TextNext トップへ">
            <Logo />
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Link href="/login" className={buttonClass("ghost", "sm")}>ログイン</Link>
            <Link href="/signup" className={buttonClass("primary", "sm")}>新規登録</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <span className="font-bold">© TextNext運営チーム</span>
          <Link href="/terms" className="hover:text-fg">利用規約</Link>
          <Link href="/privacy" className="hover:text-fg">プライバシーポリシー</Link>
          <Link href="/contact" className="hover:text-fg">お問い合わせ</Link>
        </div>
      </footer>
    </div>
  );
}
