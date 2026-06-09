import { Link } from "react-router-dom";
import { Cloud, Cpu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GithubAvatar } from "@/components/ui/avatar";
import { OrgLogo } from "@/components/ui/org-logo";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-500 ring-amber-400/30",
  2: "bg-zinc-400/15 text-zinc-400 ring-zinc-400/30",
  3: "bg-orange-500/15 text-orange-500 ring-orange-500/30"
};

/** 首頁概覽卡:整張卡可點擊進入詳細頁。 */
export function SubmissionCard({ row, rank }: { row: SubmissionRow; rank: number }) {
  const isCloud = row.deployment === "cloud";
  const isClosed = row.access === "closed";

  return (
    <Link
      to={`/s/${row.id}`}
      className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-[3px]"
    >
      <Card className="hover:border-ring/50 hover:bg-accent/30 flex-row items-center gap-3 px-4 py-3 transition-colors sm:gap-4 sm:px-5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1",
            RANK_STYLES[rank] ?? "bg-muted text-muted-foreground ring-border"
          )}
        >
          {rank}
        </div>

        <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={44} />

        {/* 重點:模型 name;副標:作者 */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-base leading-tight font-semibold" title={row.modelName}>
            {row.modelName}
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <GithubAvatar username={row.author} size={16} linked={false} />
            <span className="truncate">@{row.author}</span>
            {row.modelId ? (
              <>
                <span className="text-border">·</span>
                <span className="truncate font-mono opacity-70">{row.modelId}</span>
              </>
            ) : null}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                isCloud
                  ? "border-sky-500/30 text-sky-600 dark:text-sky-400"
                  : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {isCloud ? <Cloud className="size-3" /> : <Cpu className="size-3" />}
              {isCloud ? "雲端" : "本地"}
            </Badge>
            <Badge variant="outline">{isClosed ? "閉源" : "開源"}</Badge>
            {row.quantLevel ? (
              <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400">
                {[row.quantFormat, row.quantLevel].filter(Boolean).join(" ")}
              </Badge>
            ) : null}
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              {row.backendName || "?"}
            </Badge>
            {row.hwDevice ? (
              <Badge
                variant="outline"
                className="hidden border-orange-500/30 text-orange-600 sm:inline-flex dark:text-orange-400"
              >
                {row.hwDevice}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <span className="text-2xl leading-none font-bold tabular-nums">
            {row.scoreTotal.toFixed(1)}
          </span>
          <span className="text-muted-foreground mt-1 text-xs tabular-nums">
            {row.passCount}/{row.totalCount} 通過
          </span>
        </div>
      </Card>
    </Link>
  );
}
