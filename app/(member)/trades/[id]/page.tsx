import { Suspense } from "react";
import { PageSpinner } from "@/components/ui/spinner";
import { TradeRoom } from "./trade-room";

export default async function TradePage({ params }: PageProps<"/trades/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSpinner />}>
      <TradeRoom id={id} />
    </Suspense>
  );
}
