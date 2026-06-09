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
  className?: string;
}

/** 模型廠牌 logo:優先用 HuggingFace 頭像,失敗 / 無資料時退回彩色字母圖示。 */
export function OrgLogo({ org, avatar, size = 44, className }: OrgLogoProps) {
  const [failed, setFailed] = useState(false);
  const label = org ?? "?";
  const showImg = avatar && !failed;

  return (
    <span
      title={org ?? undefined}
      className={cn(
        "ring-border bg-background inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 select-none",
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
        <span className="text-base font-bold">{label.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
