import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { getResults, getSubmissionByFile } from "@/lib/db";
import { loadExam, type ExamPack } from "@/lib/exam";
import { useI18n, type TFn } from "@/lib/i18n";
import { parseModelLink } from "@/lib/modelLink";
import { formatPass, statusKind } from "@/lib/status";
import type { ResultEntry } from "@/lib/types";
import { useDb } from "@/hooks/useDb";
import { cn } from "@/lib/utils";

// 狀態 → 標籤/配色,語意一律走共用的 statusKind(避免與計分分歧)
function statusInfo(status: number | null, t: TFn) {
  const kind = statusKind(status);
  if (kind === "half")
    return { label: t("status.half"), chip: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" };
  if (kind === "skip")
    return { label: t("status.skipLong"), chip: "bg-muted/60 text-muted-foreground", dot: "bg-muted-foreground/50" };
  if (kind === "pass") return { label: t("status.passLong"), chip: "bg-primary/15 text-primary", dot: "bg-primary" };
  return { label: t("status.failLong"), chip: "bg-red-500/15 text-red-400", dot: "bg-red-400" };
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

// 把 model.args 攤平成 [key, value](巢狀物件如 spec 展成 spec.method)。
function flattenArgs(args: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) out.push([`${k}.${sk}`, String(sv)]);
    } else {
      out.push([k, Array.isArray(v) ? v.join(", ") : String(v)]);
    }
  }
  return out;
}

export default function Detail() {
  const { pack, ver, file } = useParams();
  const navigate = useNavigate();
  const { db, loading, error } = useDb();
  const { lang, t, catLabel } = useI18n();
  // 回到來源頁(對比 / 排行榜);無上一頁就退回排行榜。
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/leaderboard"));
  const [exam, setExam] = useState<ExamPack | null>(null);
  const [openQ, setOpenQ] = useState<string | null>(null);

  const row = useMemo(
    () => (db && pack && ver && file ? getSubmissionByFile(db, pack, ver, file) : null),
    [db, pack, ver, file]
  );
  const results = useMemo<ResultEntry[]>(() => (db && row ? getResults(db, row.id) : []), [db, row]);
  const wrong = results.filter((r) => isNotPassed(r.status));
  const resultById = useMemo(() => new Map(results.map((r) => [r.scenarioId, r])), [results]);

  useEffect(() => {
    if (row) loadExam(row.packName, row.packVer, lang).then(setExam);
  }, [row, lang]);

  if (loading) {
    return <p className="text-muted-foreground py-20 text-center text-sm">{t("loading")}</p>;
  }
  if (error || !row) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm">{error ?? t("detail.notFound")}</p>
        <Link to="/leaderboard" className="text-primary mt-3 inline-block text-sm">
          {t("detail.backToLb")}
        </Link>
      </div>
    );
  }

  const isCloud = row.deployment === "cloud";
  const badges = modelBadges(row, t);
  const score = Math.max(0, Math.min(100, row.scoreTotal));
  const hwExtra = Object.entries(row.hwExtra);
  const modelLink = parseModelLink(row.modelLink);
  const openExam = openQ ? exam?.scenarios[openQ] : undefined;
  const openResult = openQ ? resultById.get(openQ) : undefined;

  return (
    <main className="animate-rise mx-auto max-w-4xl px-4 pt-6 pb-12 space-y-6">
      <button
        type="button"
        onClick={goBack}
        className="text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t("detail.back")}
      </button>

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
                  aria-label={t("facet.thinking")}
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
                  {t("detail.modelPage")} <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
            ) : null}

            {/* 上傳者(GitHub)— 弱化 */}
            <div className="text-muted-foreground/50 mt-1 flex items-center gap-1.5 text-xs">
              <span>{t("detail.uploader")}</span>
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
            <div className="bg-muted/70 h-1.5 w-32 overflow-hidden rounded-full ring-1 ring-white/60">
              <div className="gauge-fill bg-primary h-full rounded-full" style={{ width: `${score}%` }} />
            </div>
            <span className="text-muted-foreground font-data text-xs tabular-nums">
              {t("detail.q.passInfo", { pass: formatPass(row.passCount, row.halfCount), total: row.totalCount })}
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
          <Panel title={t("detail.panel.cats")} titleSize="text-sm">
            <div className="flex flex-col gap-3">
              {row.scoreCats.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{catLabel(cat.label ?? cat.id)}</span>
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

        <Panel title={isCloud ? t("detail.panel.provider") : t("detail.panel.hardware")} titleSize="text-sm">
          <div className="grid grid-cols-2 gap-3">
            {isCloud ? (
              <Meta label={t("detail.meta.backend")} value={`${row.backendName}${row.backendVer ? ` ${row.backendVer}` : ""}`} />
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
                {row.hwChip ? <Meta label={t("detail.meta.chip")} value={row.hwChip} /> : null}
                {row.hwDriver ? <Meta label={t("detail.meta.driver")} value={row.hwDriver} /> : null}
                {row.hwOs ? <Meta label={t("detail.meta.os")} value={row.hwOs} /> : null}
                {hwExtra.map(([k, v]) => (
                  <Meta key={k} label={k} value={String(v)} />
                ))}
              </>
            )}
          </div>
        </Panel>

        {row.sizeActive || row.sizeParams ? (
          <Panel title={t("detail.panel.active")} titleSize="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-data text-3xl leading-none font-bold tabular-nums">
                {row.sizeActive ?? row.sizeParams}
              </span>
              {row.sizeParams && row.sizeActive && row.sizeActive !== row.sizeParams ? (
                <span className="text-muted-foreground text-sm">{t("detail.active.total", { x: row.sizeParams })}</span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">{t("detail.active.hint")}</p>
          </Panel>
        ) : null}

        <Panel title={t("detail.panel.run")} titleSize="text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Meta label={t("detail.meta.date")} value={row.runDate.slice(0, 10)} />
            {row.runMode ? <Meta label={t("detail.meta.mode")} value={row.runMode} /> : null}
            <Meta label={t("detail.meta.runs")} value={`${row.runsPerTest}x`} />
            <Meta label="BenchLocal" value={row.benchlocal} />
            <Meta label={t("detail.meta.avg")} value={formatTime(row.totalCount ? row.totalTime / row.totalCount : 0)} />
          </div>
        </Panel>

        {row.args && Object.keys(row.args).length > 0 ? (
          <Panel title={t("detail.panel.args")} titleSize="text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {flattenArgs(row.args).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground truncate font-mono text-xs">{k}</span>
                  <span className="font-data tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>

      {/* 題目結果 */}
      <Panel
        title={`${t("detail.q.title")} · ${t("detail.q.passInfo", {
          pass: formatPass(row.passCount, row.halfCount),
          total: row.totalCount
        })}${row.halfCount > 0 ? t("detail.q.half", { n: row.halfCount }) : ""} · ${t("detail.q.wrong", { n: wrong.length })}`}
        titleSize="text-sm"
      >
        <p className="text-muted-foreground mb-3 text-xs">{t("detail.q.hint")}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {results.map((r) => {
            const info = statusInfo(r.status, t);
            const sc = exam?.scenarios[r.scenarioId];
            return (
              <button
                key={r.scenarioId}
                type="button"
                onClick={() => setOpenQ(r.scenarioId)}
                className="group border-border/60 bg-card/40 hover:border-primary/50 hover:bg-muted/40 flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors"
              >
                <span
                  className={cn(
                    "font-data grid h-8 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums",
                    info.chip
                  )}
                >
                  {shortId(r.scenarioId)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={sc?.title}>
                    {sc?.title ?? r.scenarioId}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <span className={cn("size-1.5 shrink-0 rounded-full", info.dot)} />
                    {info.label}
                    {sc?.category ? ` · ${sc.category}` : ""} · {formatTime(r.time)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 題目詳細 modal */}
      <Dialog open={openQ !== null} onOpenChange={(o) => !o && setOpenQ(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="bg-muted font-data rounded-md px-2 py-0.5 text-xs font-semibold">{openQ}</span>
              {openResult ? (
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statusInfo(openResult.status, t).chip)}>
                  {statusInfo(openResult.status, t).label} · {formatTime(openResult.time)}
                </span>
              ) : null}
            </div>
            <DialogTitle>{openExam?.title ?? t("detail.q.dialogTitle")}</DialogTitle>
            {openExam?.category ? (
              <DialogDescription>{t("detail.q.category", { x: openExam.category })}</DialogDescription>
            ) : null}
          </DialogHeader>

          {openExam ? (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <h4 className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase">
                  {t("detail.q.prompt")}
                </h4>
                <p className="leading-relaxed">{openExam.prompt}</p>
              </div>
              {openExam.criteria && openExam.criteria.length > 0 ? (
                <div>
                  <h4 className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase">
                    {t("detail.q.criteria")}
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
              {t("detail.q.noData", { pack: row.packName, ver: row.packVer, lang })}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
