import { cn } from "@/lib/cn";

export function RatingSummary({
  good,
  normal,
  bad,
  completed,
  className,
}: {
  good: number;
  normal: number;
  bad: number;
  completed?: number;
  className?: string;
}) {
  const total = good + normal + bad;
  if (total === 0) {
    return <span className={cn("text-xs text-muted", className)}>{completed ? `取引 ${completed}回` : "取引はまだありません"}</span>;
  }
  const parts = [`良い ${good}`, normal > 0 && `普通 ${normal}`, bad > 0 && `残念 ${bad}`].filter(Boolean);
  return (
    <span className={cn("tabular text-xs text-muted", className)}>
      評価 {parts.join("・")}
      {completed !== undefined && <> ／ 取引 {completed}回</>}
    </span>
  );
}
