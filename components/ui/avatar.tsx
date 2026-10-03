import { storagePublicUrl } from "@/lib/env";
import { cn } from "@/lib/cn";

const PALETTE = ["#5a78c8", "#4c8c7e", "#b8745a", "#7f73b8", "#a68b45", "#55869f", "#b06a7f", "#6f7b8c"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  path,
  name,
  seed,
  size = 40,
  className,
}: {
  path?: string | null;
  name?: string | null;
  seed?: string | null;
  size?: number;
  className?: string;
}) {
  const label = (name ?? "?").trim();
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) };
  if (path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={storagePublicUrl("avatars", path)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={cn("shrink-0 rounded-full bg-surface-2 object-cover", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-bold text-white", className)}
      style={{ ...style, background: colorFor(seed ?? label) }}
    >
      {Array.from(label)[0] ?? "?"}
    </span>
  );
}
