"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import type { MyContext } from "@/lib/types";

export function RestrictedScreen({ restriction }: { restriction: NonNullable<MyContext["restriction"]> }) {
  const until = restriction.ends_at ? new Date(restriction.ends_at).toLocaleString("ja-JP", { dateStyle: "long", timeStyle: "short" }) : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-bold">
        {restriction.kind === "banned" ? "アカウントが停止されています" : "アカウントの利用が制限されています"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        利用規約に基づき、出品・取引・メッセージの送信ができない状態です。
        {until && <>制限は {until} に解除されます。</>}
      </p>
      <div className="mt-4 border-l-[3px] border-danger bg-surface-2 px-4 py-3 text-sm">
        <span className="font-semibold">理由: </span>
        {restriction.reason}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        心当たりがない場合や異議がある場合は、
        <Link href="/contact" className="font-bold text-primary underline-offset-2 hover:underline">
          お問い合わせ
        </Link>
        からご連絡ください。
      </p>
      <SignOutButton className="mt-8" />
    </div>
  );
}
