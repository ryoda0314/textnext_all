import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <EmptyState icon={<SearchX />} title="ページが見つかりません" description="URLが間違っているか、削除された可能性があります。" action={<ButtonLink href="/">ホームへ</ButtonLink>} />
    </div>
  );
}
