import { useState } from "react";

import { brandIcon } from "@/components/ui/brand-icon";
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

/** 廠牌 logo:優先用官方品牌圖示,其次 HuggingFace 頭像,最後退回彩色字母圖示。 */
export function OrgLogo({ org, avatar, size = 44, radius = "rounded-xl", className }: OrgLogoProps) {
  const [failed, setFailed] = useState(false);
  const label = org ?? "?";
  const Brand = org ? brandIcon(org) : null;
  const showImg = !Brand && avatar && !failed;
  const showLetter = !Brand && !showImg;

  return (
    <span
      title={org ?? undefined}
      className={cn(
        "ring-border/70 inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 select-none",
        radius,
        Brand ? "bg-white" : "bg-background",
        showLetter && toneFor(label),
        className
      )}
      style={{ width: size, height: size }}
    >
      {Brand ? (
        <Brand size={Math.round(size * 0.64)} />
      ) : showImg ? (
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
