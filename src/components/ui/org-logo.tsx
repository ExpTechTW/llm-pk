import { useState } from "react";

import { cn } from "@/lib/utils";

const MONOGRAM_TONES = [
  "bg-rose-500/15 text-rose-500",
  "bg-orange-500/15 text-orange-500",
  "bg-amber-500/15 text-amber-600",
  "bg-emerald-500/15 text-emerald-500",
  "bg-cyan-500/15 text-cyan-500",
  "bg-indigo-500/15 text-indigo-500",
  "bg-violet-500/15 text-violet-500"
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return MONOGRAM_TONES[hash % MONOGRAM_TONES.length];
}

interface OrgLogoProps {
  org: string | null;
  avatar: string | null;
  size?: number;
  radius?: string;
  className?: string;
}

/** 廠牌 logo:優先用 HuggingFace 頭像,失敗 / 無資料時退回彩色字母圖示。 */
export function OrgLogo({ org, avatar, size = 44, radius = "rounded-xl", className }: OrgLogoProps) {
  const [failed, setFailed] = useState(false);
  const label = org ?? "?";
  const showImg = avatar && !failed;

  return (
    <span
      title={org ?? undefined}
      className={cn(
        "ring-border/70 bg-background inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 select-none",
        radius,
        !showImg && toneFor(label),
        className
      )}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={avatar}
          alt={label}
          loading="lazy"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="font-display font-extrabold" style={{ fontSize: Math.round(size * 0.44) }}>
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
