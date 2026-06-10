import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Crown, Lightbulb } from "lucide-react";

import { modelBadges, quantColor } from "@/lib/badges";
import { OrgLogo } from "@/components/ui/org-logo";
import { useI18n } from "@/lib/i18n";
import { formatPass } from "@/lib/status";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANK_ACCENT: Record<number, string> = {
  1: "text-primary",
  2: "text-foreground",
  3: "text-amber-400/90"
};

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "border-border/70 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

/** 首頁概覽卡:整張卡可點擊進入詳細頁。rank 為並列名次(同分共用),seq 為實際順序編號。 */
export function SubmissionCard({
  row,
  rank,
  index,
  seq
}: {
  row: SubmissionRow;
  rank: number;
  index: number;
  seq?: number;
}) {
  const { t } = useI18n();
  const score = Math.max(0, Math.min(100, row.scoreTotal));
  const isTop = rank <= 3;
  const isChampion = rank === 1;
  const badges = modelBadges(row, t);

  return (
    <Link
      to={`/s/${encodeURIComponent(row.packName)}/${encodeURIComponent(row.packVer)}/${encodeURIComponent(row.file)}`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      className={cn(
        "animate-rise focus-visible:ring-ring/60 group block rounded-2xl outline-none focus-visible:ring-2",
        isChampion && "champion-glow"
      )}
    >
      <article
        className={cn(
          "bg-card/80 border-border/60 hover:border-primary/40 relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 backdrop-blur-sm transition-all duration-200 sm:gap-4 sm:px-4 sm:py-3.5",
          "hover:bg-card hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]",
          isTop && "border-primary/25",
          isChampion && "champion-ring border-transparent shadow-[0_10px_40px_-12px_oklch(0.87_0.19_124/0.35)]"
        )}
      >
        {/* 名次 */}
        <div className="flex w-6 shrink-0 flex-col items-center justify-center sm:w-9">
          {isChampion ? (
            <Crown className="text-primary size-3.5 drop-shadow-[0_0_6px_oklch(0.87_0.19_124/0.6)] sm:size-4" fill="currentColor" />
          ) : null}
          <span className={cn("font-data text-xl leading-none font-bold sm:text-2xl", RANK_ACCENT[rank] ?? "text-muted-foreground")}>
            {rank}
          </span>
          {/* 順序編號:僅在與名次不同(即同分並列)時顯示,標出實際排序 */}
          {seq != null && seq !== rank ? (
            <span className="text-muted-foreground/50 font-data mt-0.5 text-[9px] leading-none tabular-nums">#{seq}</span>
          ) : null}
        </div>

        {/* 資訊(3/4)+ 分數(1/4) */}
        <div className="flex min-w-0 flex-1 items-stretch gap-3">
          {/* 資訊(3/4):上=模型資訊、下=徽章 */}
          <div className="flex w-3/4 min-w-0 flex-col justify-center gap-2">
            {/* 模型資訊:左 icon、右 model name */}
            <div className="flex min-w-0 items-center gap-2.5">
              <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={42} className="shrink-0" />
              <h3
                className="font-display flex min-w-0 flex-1 items-center gap-1.5 text-lg leading-tight font-bold tracking-tight sm:gap-2 sm:text-2xl"
                title={row.modelName}
              >
                {row.thinking ? (
                  <Lightbulb
                    className="text-amber-300/90 size-4 shrink-0 sm:size-5"
                    aria-label={t("facet.thinking")}
                  />
                ) : null}
                <span className="truncate">{row.modelName}</span>
              </h3>
            </div>
            {/* 徽章 */}
            <div className="flex flex-wrap items-center gap-1">
              {badges.map((b) => (
                <Chip key={b.label} className={b.className}>
                  <b.Icon className="size-3" />
                  {b.label}
                </Chip>
              ))}
              {row.quantFormat ? (
                <Chip className={quantColor(row.quantFormat, "text-violet-300")}>{row.quantFormat}</Chip>
              ) : null}
              {row.quantLevel ? (
                <Chip className={quantColor(row.quantLevel, "text-cyan-300")}>{row.quantLevel}</Chip>
              ) : null}
            </div>
          </div>

          {/* 分數(1/4) */}
          <div className="flex w-1/4 shrink-0 flex-col items-end justify-center gap-1.5">
            <div className="flex items-baseline">
              <span className="font-data text-2xl leading-none font-bold tabular-nums sm:text-3xl">
                {row.scoreTotal.toFixed(1).split(".")[0]}
              </span>
              <span className="text-muted-foreground/70 font-data text-xs">
                .{row.scoreTotal.toFixed(1).split(".")[1]}
              </span>
            </div>
            <div className="bg-muted/70 h-1.5 w-full overflow-hidden rounded-full ring-1 ring-white/60">
              <div
                className="gauge-fill bg-primary h-full rounded-full"
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-muted-foreground font-data text-[11px] tabular-nums">
              {formatPass(row.passCount, row.halfCount)}/{row.totalCount}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
