import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Lightbulb } from "lucide-react";

import { modelBadges } from "@/lib/badges";
import { GithubAvatar, HfAvatar } from "@/components/ui/avatar";
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
import { parseModelLink } from "@/lib/modelLink";
import { formatPass, statusKind } from "@/lib/status";
import type { ResultEntry } from "@/lib/types";
import { useDb } from "@/hooks/useDb";
import { cn } from "@/lib/utils";

// 狀態 → 標籤/配色,語意一律走共用的 statusKind(避免與計分分歧)
function statusInfo(status: number | null) {
  const kind = statusKind(status);
  if (kind === "half")
    return { label: "半對", chip: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" };
  if (kind === "skip")
    return { label: "未跑", chip: "bg-muted/60 text-muted-foreground", dot: "bg-muted-foreground/50" };
  if (kind === "pass") return { label: "正常", chip: "bg-primary/15 text-primary", dot: "bg-primary" };
  return { label: "錯誤", chip: "bg-red-500/15 text-red-400", dot: "bg-red-400" };
}

// 未通過(錯誤 + 半對),排除未跑與正常
function isNotPassed(status: number | null): boolean {
  const kind = statusKind(status);
  return kind === "half" || kind === "fail";
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

function Panel({ title, children, titleSize = "text-[10px]" }: { title: string; children: ReactNode; titleSize?: string }) {
  return (
    <section className={cn("bg-card/60 border-border/60 rounded-2xl border p-5 backdrop-blur-sm")}>
      <h2 className={cn(`text-muted-foreground mb-3 ${titleSize} font-semibold tracking-[0.16em] uppercase`)}>
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
  const wrong = results.filter((r) => isNotPassed(r.status));
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
        <Link to="/leaderboard" className="text-primary mt-3 inline-block text-sm">
          ← 回排行榜
        </Link>
      </div>
    );
  }

  const isCloud = row.deployment === "cloud";
  const badges = modelBadges(row);
  const score = Math.max(0, Math.min(100, row.scoreTotal));
  const hwExtra = Object.entries(row.hwExtra);
  const modelLink = parseModelLink(row.modelLink);
  const openExam = openQ ? exam?.scenarios[openQ] : undefined;
  const openResult = openQ ? resultById.get(openQ) : undefined;

  return (
    <main className="animate-rise mx-auto max-w-4xl px-4 pt-6 pb-12 space-y-6">
      <Link
        to="/leaderboard"
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
            <h1 className="font-display flex items-center gap-2 text-2xl leading-tight font-extrabold tracking-tight break-words">
              {row.thinking ? (
                <Lightbulb
                  className="text-amber-300/90 size-5 shrink-0"
                  aria-label="支援 thinking / reasoning 模式"
                />
              ) : null}
              <span>{row.modelName}</span>
            </h1>
            {row.modelId ? (
              <span className="text-muted-foreground font-mono text-xs break-all">{row.modelId}</span>
            ) : null}
            {/* 模型作者(HuggingFace)— 凸顯 */}
            {row.linkAuthor || modelLink ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
              {row.linkAuthor ? (
                <span className="inline-flex items-center gap-2">
                  <HfAvatar handle={row.linkAuthor} avatarUrl={row.linkAuthorAvatar} size={26} />
                  <a
                    href={`https://huggingface.co/${row.linkAuthor}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:text-primary font-semibold"
                  >
                    {row.linkAuthor}
                  </a>
                </span>
              ) : null}
              {modelLink ? (
                <a
                  href={modelLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  title={modelLink.label}
                >
                  模型頁 <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
            ) : null}

            {/* 上傳者(GitHub)— 弱化 */}
            <div className="text-muted-foreground/50 mt-1 flex items-center gap-1.5 text-xs">
              <span>成績上傳者</span>
              <GithubAvatar username={row.uploader} size={14} linked={false} />
              <a
                href={`https://github.com/${row.uploader}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-muted-foreground"
              >
                @{row.uploader}
              </a>
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
              {formatPass(row.passCount, row.halfCount)}/{row.totalCount} 通過
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
          {badges.map((b) => (
            <Chip key={b.label} className={b.className}>
              <b.Icon className="size-3" />
              {b.label}
            </Chip>
          ))}
          {row.familyName ? <Chip>{`${row.familyName}${row.familyVer ? ` ${row.familyVer}` : ""}`}</Chip> : null}
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
          <Panel title="分類分數" titleSize="text-sm">
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

        <Panel title={isCloud ? "供應商" : "硬體"} titleSize="text-sm">
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

        {row.sizeActive || row.sizeParams ? (
          <Panel title="啟動參數" titleSize="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-data text-3xl leading-none font-bold tabular-nums">
                {row.sizeActive ?? row.sizeParams}
              </span>
              {row.sizeParams && row.sizeActive && row.sizeActive !== row.sizeParams ? (
                <span className="text-muted-foreground text-sm">/ {row.sizeParams} 總參數</span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">每次推理實際啟動的參數量</p>
          </Panel>
        ) : null}

        <Panel title="執行資訊" titleSize="text-sm">
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
      <Panel
        title={`題目結果 · ${formatPass(row.passCount, row.halfCount)}/${row.totalCount} 通過${row.halfCount > 0 ? `(含半對 ${row.halfCount})` : ""},未過 ${wrong.length} 題`}
        titleSize="text-sm"
      >
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
              未過題目(錯誤 / 半對)
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
