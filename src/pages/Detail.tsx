import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cloud, Cpu, ExternalLink } from "lucide-react";

import { GithubAvatar } from "@/components/ui/avatar";
import { OrgLogo } from "@/components/ui/org-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getResults, getSubmissionById } from "@/lib/db";
import { loadExam, type ExamPack } from "@/lib/exam";
import type { ResultEntry } from "@/lib/types";
import { useDb } from "@/hooks/useDb";
import { cn } from "@/lib/utils";

function statusInfo(status: number) {
  if (status < 0) return { label: "未跑", chip: "bg-muted/60 text-muted-foreground", dot: "bg-muted-foreground/50" };
  if (status >= 1)
    return { label: "通過", chip: "bg-primary/15 text-primary", dot: "bg-primary" };
  if (status > 0)
    return { label: "部分", chip: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" };
  return { label: "失敗", chip: "bg-red-500/15 text-red-400", dot: "bg-red-400" };
}

function shortId(scenarioId: string): string {
  const m = scenarioId.match(/(\d+)\s*$/);
  return m ? m[1] : scenarioId;
}

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "border-border/70 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card/60 border-border/60 rounded-2xl border p-5 backdrop-blur-sm">
      <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.16em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
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
  const [exam, setExam] = useState<ExamPack | null>(null);
  const [openQ, setOpenQ] = useState<string | null>(null);

  const row = useMemo(() => (db && id ? getSubmissionById(db, Number(id)) : null), [db, id]);
  const results = useMemo<ResultEntry[]>(() => (db && id ? getResults(db, Number(id)) : []), [db, id]);
  const wrong = results.filter((r) => r.status >= 0 && r.status < 1);
  const resultById = useMemo(() => new Map(results.map((r) => [r.scenarioId, r])), [results]);

  useEffect(() => {
    if (row) loadExam(row.packName, row.packVer).then(setExam);
  }, [row]);

  if (loading) {
    return <p className="text-muted-foreground py-20 text-center text-sm">載入中…</p>;
  }
  if (error || !row) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm">{error ?? "找不到這筆投稿。"}</p>
        <Link to="/" className="text-primary mt-3 inline-block text-sm">
          ← 回排行榜
        </Link>
      </div>
    );
  }

  const isCloud = row.deployment === "cloud";
  const score = Math.max(0, Math.min(100, row.scoreTotal));
  const hwExtra = Object.entries(row.hwExtra);
  const openExam = openQ ? exam?.scenarios[openQ] : undefined;
  const openResult = openQ ? resultById.get(openQ) : undefined;

  return (
    <main className="animate-rise mx-auto max-w-4xl px-4 pt-6 pb-12">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        排行榜
      </Link>

      {/* 標頭 */}
      <header className="bg-card/70 border-border/60 relative overflow-hidden rounded-3xl border p-6 backdrop-blur-sm">
        <div className="from-primary/[0.07] pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={64} radius="rounded-2xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight break-words">
              {row.modelName}
            </h1>
            {row.modelId ? (
              <span className="text-muted-foreground font-mono text-xs break-all">{row.modelId}</span>
            ) : null}
            <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
              <GithubAvatar username={row.author} size={20} />
              <a
                href={`https://github.com/${row.author}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                @{row.author}
              </a>
              {row.modelLink ? (
                <>
                  <span className="text-border">·</span>
                  <a
                    href={row.modelLink}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground inline-flex items-center gap-1"
                  >
                    模型頁 <ExternalLink className="size-3" />
                  </a>
                </>
              ) : null}
            </div>
          </div>

          {/* 分數 */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-baseline gap-1">
              <span className="font-data text-5xl leading-none font-bold tabular-nums">
                {row.scoreTotal.toFixed(1)}
              </span>
            </div>
            <div className="bg-muted/70 h-1.5 w-32 overflow-hidden rounded-full">
              <div className="gauge-fill bg-primary h-full rounded-full" style={{ width: `${score}%` }} />
            </div>
            <span className="text-muted-foreground font-data text-xs tabular-nums">
              {row.passCount}/{row.totalCount} 通過
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
          <Chip className={isCloud ? "text-sky-300" : "text-primary"}>
            {isCloud ? <Cloud className="size-3" /> : <Cpu className="size-3" />}
            {isCloud ? "雲端" : "本地"}
          </Chip>
          <Chip>{row.access === "closed" ? "閉源" : "開源"}</Chip>
          {row.familyName ? <Chip>{`${row.familyName}${row.familyVer ? ` ${row.familyVer}` : ""}`}</Chip> : null}
          {row.modelType ? <Chip>{row.modelType}</Chip> : null}
          {row.sizeParams ? (
            <Chip>
              {row.sizeParams}
              {row.sizeActive && row.sizeActive !== row.sizeParams ? ` · A${row.sizeActive}` : ""}
            </Chip>
          ) : null}
          {row.quantLevel ? (
            <Chip className="text-foreground">
              {[row.quantFormat, row.quantLevel, row.quantMethod].filter(Boolean).join(" · ")}
            </Chip>
          ) : null}
          <Chip className="text-foreground">
            {row.backendName}
            {row.backendVer ? ` ${row.backendVer}` : ""}
          </Chip>
        </div>
      </header>

      {/* 資訊區塊 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {row.scoreCats.length > 0 ? (
          <Panel title="分類分數">
            <div className="flex flex-col gap-3">
              {row.scoreCats.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{cat.label ?? cat.id}</span>
                    <span className="font-data font-semibold tabular-nums">{cat.score}</span>
                  </div>
                  <div className="bg-muted/70 h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary/70 h-full rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, cat.score))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title={isCloud ? "供應商" : "硬體"}>
          <div className="grid grid-cols-2 gap-3">
            {isCloud ? (
              <Meta label="後端 / API" value={`${row.backendName}${row.backendVer ? ` ${row.backendVer}` : ""}`} />
            ) : (
              <>
                {row.hwCompany ? (
                  <div className="col-span-2 flex items-center gap-2">
                    <OrgLogo org={row.hwCompany} avatar={row.hwAvatar} size={22} radius="rounded-md" />
                    <span className="text-sm font-medium">
                      {[row.hwCompany, row.hwDevice].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ) : null}
                {row.hwChip ? <Meta label="晶片" value={row.hwChip} /> : null}
                {row.hwDriver ? <Meta label="驅動" value={row.hwDriver} /> : null}
                {row.hwOs ? <Meta label="OS" value={row.hwOs} /> : null}
                {hwExtra.map(([k, v]) => (
                  <Meta key={k} label={k} value={String(v)} />
                ))}
              </>
            )}
          </div>
        </Panel>

        <Panel title="執行資訊">
          <div className="grid grid-cols-2 gap-3">
            <Meta label="日期" value={row.runDate.slice(0, 10)} />
            {row.runMode ? <Meta label="模式" value={row.runMode} /> : null}
            <Meta label="每題次數" value={`${row.runsPerTest}x`} />
            <Meta label="BenchLocal" value={row.benchlocal} />
            <Meta label="平均每題" value={formatTime(row.totalCount ? row.totalTime / row.totalCount : 0)} />
          </div>
        </Panel>
      </div>

      {/* 題目結果 */}
      <Panel title={`題目結果 · ${row.passCount}/${row.totalCount} 通過,錯 ${wrong.length} 題`}>
        <p className="text-muted-foreground mb-3 text-xs">點題號查看題目與評分標準</p>
        <div className="flex flex-wrap gap-1.5">
          {results.map((r) => {
            const info = statusInfo(r.status);
            return (
              <button
                key={r.scenarioId}
                type="button"
                onClick={() => setOpenQ(r.scenarioId)}
                title={`${r.scenarioId} · ${info.label} · ${formatTime(r.time)}`}
                className={cn(
                  "font-data hover:ring-primary/60 grid h-10 w-10 place-items-center rounded-lg text-sm font-semibold tabular-nums transition-all hover:scale-105 hover:ring-2",
                  info.chip
                )}
              >
                {shortId(r.scenarioId)}
              </button>
            );
          })}
        </div>

        {wrong.length > 0 ? (
          <div className="mt-5 flex flex-col gap-1">
            <span className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase">
              錯題清單
            </span>
            <div className="divide-border/60 flex flex-col divide-y">
              {wrong.map((r) => {
                const info = statusInfo(r.status);
                return (
                  <button
                    key={r.scenarioId}
                    type="button"
                    onClick={() => setOpenQ(r.scenarioId)}
                    className="hover:bg-muted/40 -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", info.dot)} />
                      <span className="font-mono">{r.scenarioId}</span>
                      <span className="text-muted-foreground truncate">
                        {exam?.scenarios[r.scenarioId]?.title ?? ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", info.chip)}>{info.label}</span>
                      <span className="text-muted-foreground font-data text-xs tabular-nums">{formatTime(r.time)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">全部題目通過 🎉</p>
        )}
      </Panel>

      {/* 題目詳細 modal */}
      <Dialog open={openQ !== null} onOpenChange={(o) => !o && setOpenQ(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="bg-muted font-data rounded-md px-2 py-0.5 text-xs font-semibold">{openQ}</span>
              {openResult ? (
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statusInfo(openResult.status).chip)}>
                  {statusInfo(openResult.status).label} · {formatTime(openResult.time)}
                </span>
              ) : null}
            </div>
            <DialogTitle>{openExam?.title ?? "題目"}</DialogTitle>
            {openExam?.category ? (
              <DialogDescription>分類:{openExam.category}</DialogDescription>
            ) : null}
          </DialogHeader>

          {openExam ? (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <h4 className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase">
                  題目
                </h4>
                <p className="leading-relaxed">{openExam.prompt}</p>
              </div>
              {openExam.criteria && openExam.criteria.length > 0 ? (
                <div>
                  <h4 className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase">
                    評分標準
                  </h4>
                  <ul className="flex flex-col gap-1.5">
                    {openExam.criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                        <span className="leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              尚無此題的題目資料。請在 <code className="font-mono text-xs">public/exam/{row.packName}/{row.packVer}.json</code> 補上。
            </p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
