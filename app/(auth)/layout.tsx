import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 pt-safe">
        <Link href="/welcome" aria-label="TextNext トップへ">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-12 pt-4 sm:pt-10">{children}</main>
      <footer className="flex justify-center gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-muted">
        <Link href="/terms" className="hover:text-fg">利用規約</Link>
        <Link href="/privacy" className="hover:text-fg">プライバシーポリシー</Link>
        <Link href="/contact" className="hover:text-fg">お問い合わせ</Link>
      </footer>
    </div>
  );
}
