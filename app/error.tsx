"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <EmptyState
        icon={<TriangleAlert />}
        title="問題が発生しました"
        description="通信環境を確認して、もう一度お試しください。続く場合はお問い合わせください。"
        action={
          <div className="flex gap-2">
            <Button onClick={reset} icon={<RotateCw className="size-4" />}>再読み込み</Button>
            <ButtonLink href="/" variant="secondary">ホームへ</ButtonLink>
          </div>
        }
      />
    </div>
  );
}
