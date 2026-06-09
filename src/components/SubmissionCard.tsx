import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cloud, Cpu } from "lucide-react";

import { GithubAvatar } from "@/components/ui/avatar";
import { OrgLogo } from "@/components/ui/org-logo";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANK_ACCENT: Record<number, string> = {
  1: "text-primary",
  2: "text-foreground",
  3: "text-amber-400/90"
};

// 量化標籤特例配色:命中關鍵字者套用指定色,其餘用預設(格式=紫、等級=青)。
const QUANT_COLOR_RULES: { match: string[]; className: string }[] = [
  { match: ["BF16", "Q8"], className: "text-orange-300" },
  { match: ["GGUF"], className: "text-emerald-300" },
  { match: ["SAFETENSORS"], className: "text-blue-300" }
];

function quantColor(value: string, fallback: string): string {
  const up = value.toUpperCase();
  const rule = QUANT_COLOR_RULES.find((r) => r.match.some((m) => up.includes(m)));
  return rule ? rule.className : fallback;
}

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

/** 首頁概覽卡:整張卡可點擊進入詳細頁。 */
export function SubmissionCard({ row, rank, index }: { row: SubmissionRow; rank: number; index: number }) {
  const isCloud = row.deployment === "cloud";
  const score = Math.max(0, Math.min(100, row.scoreTotal));
  const isTop = rank <= 3;

  return (
    <Link
      to={`/s/${row.id}`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      className="animate-rise focus-visible:ring-ring/60 group block rounded-2xl outline-none focus-visible:ring-2"
    >
      <article
        className={cn(
          "bg-card/80 border-border/60 hover:border-primary/40 relative flex items-center gap-4 overflow-hidden rounded-2xl border px-4 py-3.5 backdrop-blur-sm transition-all duration-200",
          "hover:bg-card hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]",
          isTop && "border-primary/25"
        )}
      >
        {/* 名次 */}
        <div className="flex w-9 shrink-0 flex-col items-center">
          <span className={cn("font-data text-2xl leading-none font-bold", RANK_ACCENT[rank] ?? "text-muted-foreground")}>
            {rank}
          </span>
          {isTop ? <span className="text-muted-foreground/60 text-[9px] tracking-widest uppercase">rank</span> : null}
        </div>

        {/* 廠牌 logo */}
        <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={46} />

        {/* 名稱 + 作者 + 標籤 */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3
            className="font-display truncate text-[17px] leading-tight font-bold tracking-tight"
            title={row.modelName}
          >
            {row.modelName}
          </h3>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <GithubAvatar username={row.author} size={16} linked={false} />
              <span className="truncate">@{row.author}</span>
            </span>
            {row.modelId ? (
              <span className="text-muted-foreground/60 hidden truncate font-mono sm:inline">{row.modelId}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Chip className={isCloud ? "text-sky-300/90" : "text-primary"}>
              {isCloud ? <Cloud className="size-3" /> : <Cpu className="size-3" />}
              {isCloud ? "雲端" : "開源"}
            </Chip>
            {isCloud ? <Chip>{row.access === "closed" ? "閉源" : "開源"}</Chip> : null}
            {row.quantFormat ? (
              <Chip className={quantColor(row.quantFormat, "text-violet-300")}>{row.quantFormat}</Chip>
            ) : null}
            {row.quantLevel ? (
              <Chip className={quantColor(row.quantLevel, "text-cyan-300")}>{row.quantLevel}</Chip>
            ) : null}
          </div>
        </div>

        {/* 分數 + 量表 */}
        <div className="flex w-20 shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-baseline">
            <span className="font-data text-3xl leading-none font-bold tabular-nums">
              {row.scoreTotal.toFixed(1).split(".")[0]}
            </span>
            <span className="text-muted-foreground/70 font-data text-xs">
              .{row.scoreTotal.toFixed(1).split(".")[1]}
            </span>
          </div>
          <div className="bg-muted/70 h-1 w-full overflow-hidden rounded-full">
            <div
              className="gauge-fill bg-primary h-full rounded-full"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-muted-foreground font-data text-[11px] tabular-nums">
            {row.passCount}/{row.totalCount}
          </span>
        </div>
      </article>
    </Link>
  );
}
