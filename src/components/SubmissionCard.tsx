import { Cloud, Cpu, ExternalLink, Gauge, Repeat2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GithubAvatar } from "@/components/ui/avatar";
import { avgTime } from "@/lib/filters";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-500 ring-amber-400/30",
  2: "bg-zinc-400/15 text-zinc-400 ring-zinc-400/30",
  3: "bg-orange-500/15 text-orange-500 ring-orange-500/30"
};

const TONE = {
  local: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  cloud: "border-sky-500/30 text-sky-600 dark:text-sky-400",
  open: "border-green-500/30 text-green-600 dark:text-green-400",
  closed: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  family: "border-violet-500/30 text-violet-600 dark:text-violet-400",
  quant: "border-blue-500/30 text-blue-600 dark:text-blue-400",
  backend: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
  hw: "border-orange-500/30 text-orange-600 dark:text-orange-400"
} as const;

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function SubmissionCard({ row, rank }: { row: SubmissionRow; rank: number }) {
  const isCloud = row.deployment === "cloud";
  const isClosed = row.access === "closed";
  const extraEntries = Object.entries(row.hwExtra);

  const details: string[] = [];
  if (row.hwOs) details.push(row.hwOs);
  if (row.hwDriver) details.push(`driver ${row.hwDriver}`);
  for (const [k, v] of extraEntries) details.push(`${k} ${v}`);
  if (row.runMode) details.push(`mode ${row.runMode}`);
  details.push(`BenchLocal ${row.benchlocal}`);
  details.push(formatDate(row.runDate));

  return (
    <Card className="hover:border-ring/50 gap-3 px-5 py-4 transition-colors">
      {/* 上排:名次 + 頭像 + 模型 + 分數 */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1",
            RANK_STYLES[rank] ?? "bg-muted text-muted-foreground ring-border"
          )}
        >
          {rank}
        </div>
        <GithubAvatar username={row.author} size={36} className="mt-0.5" />

        <div className="flex min-w-0 flex-1 flex-col">
          {row.modelLink ? (
            <a
              href={row.modelLink}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary inline-flex items-center gap-1 font-semibold break-all"
              title={row.modelName}
            >
              <span className="break-all">{row.modelName}</span>
              <ExternalLink className="size-3.5 shrink-0 opacity-60" />
            </a>
          ) : (
            <span className="font-semibold break-all" title={row.modelName}>
              {row.modelName}
            </span>
          )}
          <a
            href={`https://github.com/${row.author}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground w-fit text-xs"
          >
            @{row.author}
          </a>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <span className="text-2xl leading-none font-bold tabular-nums">
            {row.scoreTotal.toFixed(1)}
          </span>
          <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs tabular-nums">
            {row.passCount}/{row.totalCount} 通過
          </span>
          <span className="text-muted-foreground flex items-center gap-2 text-xs tabular-nums">
            <span className="inline-flex items-center gap-0.5">
              <Gauge className="size-3" />
              {formatTime(avgTime(row))}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Repeat2 className="size-3" />
              {row.runsPerTest}x
            </span>
          </span>
        </div>
      </div>

      {/* 中排:標籤 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("gap-1", isCloud ? TONE.cloud : TONE.local)}>
          {isCloud ? <Cloud className="size-3" /> : <Cpu className="size-3" />}
          {isCloud ? "雲端" : "本地"}
        </Badge>
        <Badge variant="outline" className={isClosed ? TONE.closed : TONE.open}>
          {isClosed ? "閉源" : "開源"}
        </Badge>
        {row.familyName ? (
          <Badge variant="outline" className={TONE.family}>
            {row.familyName}
            {row.familyVer ? ` ${row.familyVer}` : ""}
          </Badge>
        ) : null}
        {row.modelType ? <Badge variant="outline">{row.modelType}</Badge> : null}
        {row.sizeParams ? (
          <Badge variant="outline">
            {row.sizeParams}
            {row.sizeActive && row.sizeActive !== row.sizeParams ? ` · A${row.sizeActive}` : ""}
          </Badge>
        ) : null}
        {row.quantLevel ? (
          <Badge variant="outline" className={TONE.quant}>
            {[row.quantFormat, row.quantLevel, row.quantMethod].filter(Boolean).join(" · ")}
          </Badge>
        ) : null}
        <Badge variant="outline" className={TONE.backend}>
          {row.backendName || "?"}
          {row.backendVer ? ` ${row.backendVer}` : ""}
        </Badge>
        {row.hwDevice || row.hwCompany ? (
          <Badge variant="outline" className={TONE.hw}>
            {[row.hwCompany, row.hwDevice, row.hwChip].filter(Boolean).join(" · ")}
          </Badge>
        ) : null}
      </div>

      {/* 下排:細節 + 分類分數 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.scoreCats.map((cat) => (
          <span key={cat.id} className="text-muted-foreground text-xs">
            <span className="text-foreground/70 font-medium">{cat.label ?? cat.id}</span>{" "}
            <span className="tabular-nums">{cat.score}</span>
          </span>
        ))}
        {row.scoreCats.length > 0 && details.length > 0 ? (
          <span className="bg-border h-3 w-px" aria-hidden />
        ) : null}
        <span className="text-muted-foreground text-xs">{details.join(" · ")}</span>
      </div>
    </Card>
  );
}
