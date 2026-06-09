import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cloud, Cpu, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubAvatar } from "@/components/ui/avatar";
import { OrgLogo } from "@/components/ui/org-logo";
import { getResults, getSubmissionById } from "@/lib/db";
import type { ResultEntry } from "@/lib/types";
import { useDb } from "@/hooks/useDb";
import { cn } from "@/lib/utils";

function statusInfo(status: number) {
  if (status < 0) return { label: "未跑", chip: "bg-muted text-muted-foreground" };
  if (status >= 1) return { label: "通過", chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  if (status > 0) return { label: "部分", chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  return { label: "失敗", chip: "bg-red-500/15 text-red-600 dark:text-red-400" };
}

function shortId(scenarioId: string): string {
  const m = scenarioId.match(/(\d+)\s*$/);
  return m ? m[1] : scenarioId;
}

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

export default function Detail() {
  const { id } = useParams();
  const { db, loading, error } = useDb();

  const row = useMemo(() => (db && id ? getSubmissionById(db, Number(id)) : null), [db, id]);
  const results = useMemo<ResultEntry[]>(
    () => (db && id ? getResults(db, Number(id)) : []),
    [db, id]
  );
  const wrong = results.filter((r) => r.status >= 0 && r.status < 1);

  if (loading) {
    return <p className="text-muted-foreground py-16 text-center text-sm">載入中…</p>;
  }
  if (error || !row) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm">{error ?? "找不到這筆投稿。"}</p>
        <Link to="/" className="text-primary mt-3 inline-block text-sm">
          ← 回排行榜
        </Link>
      </div>
    );
  }

  const isCloud = row.deployment === "cloud";
  const isClosed = row.access === "closed";

  const hwExtra = Object.entries(row.hwExtra);

  return (
    <main className="mx-auto max-w-4xl px-4 pt-6 pb-20">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        排行榜
      </Link>

      {/* 標頭 */}
      <Card className="gap-4">
        <CardHeader>
          <div className="flex items-start gap-4">
            <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={56} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="text-xl leading-tight font-bold break-words">{row.modelName}</h1>
              {row.modelId ? (
                <span className="text-muted-foreground font-mono text-xs break-all">{row.modelId}</span>
              ) : null}
              <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                <GithubAvatar username={row.author} size={18} />
                <a
                  href={`https://github.com/${row.author}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  @{row.author}
                </a>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-4xl leading-none font-bold tabular-nums">
                {row.scoreTotal.toFixed(1)}
              </span>
              <span className="text-muted-foreground mt-1 text-xs tabular-nums">
                {row.passCount}/{row.totalCount} 通過
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            {row.familyName ? (
              <Badge variant="outline" className="border-violet-500/30 text-violet-600 dark:text-violet-400">
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
              <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400">
                {[row.quantFormat, row.quantLevel, row.quantMethod].filter(Boolean).join(" · ")}
              </Badge>
            ) : null}
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              {row.backendName || "?"}
              {row.backendVer ? ` ${row.backendVer}` : ""}
            </Badge>
            {row.modelLink ? (
              <a
                href={row.modelLink}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-xs"
              >
                模型頁 <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {/* 資訊區塊 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {row.scoreCats.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">分類分數</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {row.scoreCats.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{cat.label ?? cat.id}</span>
                  <span className="font-semibold tabular-nums">{cat.score}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{isCloud ? "供應商" : "硬體"}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {isCloud ? (
              <Meta label="後端 / API" value={`${row.backendName}${row.backendVer ? ` ${row.backendVer}` : ""}`} />
            ) : (
              <>
                {row.hwCompany ? <Meta label="廠牌" value={row.hwCompany} /> : null}
                {row.hwDevice ? <Meta label="裝置" value={row.hwDevice} /> : null}
                {row.hwChip ? <Meta label="晶片" value={row.hwChip} /> : null}
                {row.hwDriver ? <Meta label="驅動" value={row.hwDriver} /> : null}
                {row.hwOs ? <Meta label="OS" value={row.hwOs} /> : null}
                {hwExtra.map(([k, v]) => (
                  <Meta key={k} label={k} value={String(v)} />
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">執行資訊</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Meta label="日期" value={row.runDate.slice(0, 10)} />
            {row.runMode ? <Meta label="模式" value={row.runMode} /> : null}
            <Meta label="每題次數" value={`${row.runsPerTest}x`} />
            <Meta label="BenchLocal" value={row.benchlocal} />
            <Meta label="平均每題" value={formatTime(row.totalCount ? row.totalTime / row.totalCount : 0)} />
          </CardContent>
        </Card>
      </div>

      {/* 題目結果 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">
            題目結果{" "}
            <span className="text-muted-foreground font-normal">
              （{row.passCount}/{row.totalCount} 通過,錯 {wrong.length} 題)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* 色塊格 */}
          <div className="flex flex-wrap gap-1.5">
            {results.map((r) => {
              const info = statusInfo(r.status);
              return (
                <span
                  key={r.scenarioId}
                  title={`${r.scenarioId} · ${info.label} · ${formatTime(r.time)}`}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                    info.chip
                  )}
                >
                  {shortId(r.scenarioId)}
                </span>
              );
            })}
          </div>

          {/* 錯題清單 */}
          {wrong.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                錯題清單
              </span>
              <div className="flex flex-col divide-y">
                {wrong.map((r) => {
                  const info = statusInfo(r.status);
                  return (
                    <div key={r.scenarioId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="font-mono">{r.scenarioId}</span>
                      <span className="flex items-center gap-3">
                        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", info.chip)}>
                          {info.label}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">{formatTime(r.time)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">全部題目通過 🎉</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
