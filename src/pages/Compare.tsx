import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, GitCompareArrows, Layers, Loader2 } from "lucide-react";

import { OrgLogo } from "@/components/ui/org-logo";
import { HfAvatar } from "@/components/ui/avatar";
import { PackSelect } from "@/components/PackSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { getPacks, getResults, getSubmissionsByPack } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { modelBadges } from "@/lib/badges";
import { avgTime } from "@/lib/filters";
import { loadExam, type ExamPack } from "@/lib/exam";
import { statusKind } from "@/lib/status";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

// 左 = A、右 = B 的代表色(同時用在身分卡、長條、雷達圖)。
const COLOR_A = "#22d3ee"; // cyan-400
const COLOR_B = "#f59e0b"; // amber-500

function fmtSec(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

/* ----------------------------- 身分卡 ----------------------------- */

function IdentityCard({
  row,
  color,
  side
}: {
  row: SubmissionRow;
  color: string;
  side: "A" | "B";
}) {
  const badges = modelBadges(row);
  return (
    <div className="bg-card/70 relative flex flex-col items-center gap-2.5 overflow-hidden rounded-2xl border border-t-2 p-4 text-center" style={{ borderTopColor: color }}>
      <span
        className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold"
        style={{ color, backgroundColor: `${color}22` }}
      >
        {side}
      </span>
      <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={52} radius="rounded-2xl" />
      <div className="min-w-0">
        <div className="font-display truncate text-sm leading-tight font-bold sm:text-base" title={row.modelName}>
          {row.modelName}
        </div>
        {row.linkAuthor ? (
          <div className="text-muted-foreground/70 mt-0.5 flex items-center justify-center gap-1 text-xs">
            <HfAvatar handle={row.linkAuthor} avatarUrl={row.linkAuthorAvatar} size={14} linked={false} />
            <span className="truncate">{row.linkAuthor}</span>
          </div>
        ) : null}
      </div>
      <div className="font-data text-3xl leading-none font-bold tabular-nums" style={{ color }}>
        {row.scoreTotal.toFixed(1)}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {badges.map((b) => (
          <span
            key={b.label}
            className={cn(
              "border-border/70 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              b.className
            )}
          >
            <b.Icon className="size-3" />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- 左右對比長條 --------------------------- */

interface Metric {
  label: string;
  a: number | null;
  b: number | null;
  fmt: (v: number) => string;
  max: number; // 正規化用的上限(0~max → 0~100% 長條)
  higherBetter: boolean;
}

function VersusBar({ m }: { m: Metric }) {
  const a = m.a;
  const b = m.b;
  const pct = (v: number | null) => (v == null ? 0 : Math.max(0, Math.min(100, (v / m.max) * 100)));
  const both = a != null && b != null && a !== b;
  const aWin = both && (m.higherBetter ? (a as number) > (b as number) : (a as number) < (b as number));
  const bWin = both && !aWin;

  return (
    <div className="border-border/40 grid grid-cols-[3.2rem_1fr_3.2rem] items-center gap-2 border-b py-2 last:border-0 sm:grid-cols-[4rem_1fr_4rem]">
      <div
        className={cn("font-data text-right text-sm tabular-nums", aWin ? "font-bold" : "text-foreground/70")}
        style={aWin ? { color: COLOR_A } : undefined}
      >
        {a != null ? m.fmt(a) : "—"}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-muted-foreground text-[10px] tracking-wide sm:text-[11px]">{m.label}</span>
        <div className="flex h-2.5 w-full items-center">
          {/* 左半:A 由中線往左長 */}
          <div className="flex h-full w-1/2 justify-end">
            <div
              className="h-full rounded-l-full"
              style={{ width: `${pct(a)}%`, backgroundColor: COLOR_A, opacity: aWin || !both ? 1 : 0.55 }}
            />
          </div>
          {/* 右半:B 由中線往右長 */}
          <div className="flex h-full w-1/2 justify-start">
            <div
              className="h-full rounded-r-full"
              style={{ width: `${pct(b)}%`, backgroundColor: COLOR_B, opacity: bWin || !both ? 1 : 0.55 }}
            />
          </div>
        </div>
      </div>

      <div
        className={cn("font-data text-left text-sm tabular-nums", bWin ? "font-bold" : "text-foreground/70")}
        style={bWin ? { color: COLOR_B } : undefined}
      >
        {b != null ? m.fmt(b) : "—"}
      </div>
    </div>
  );
}

/* ------------------------------ 雷達圖 ------------------------------ */

function Radar({
  labels,
  aVals,
  bVals
}: {
  labels: string[];
  aVals: number[];
  bVals: number[];
}) {
  const n = labels.length;
  if (n < 3) return null; // 少於 3 軸畫雷達沒意義

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 56;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (val: number, i: number) => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * R;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const polygon = (vals: number[]) => vals.map((v, i) => pt(v, i).join(",")).join(" ");
  const rings = [25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label="類別分數雷達圖">
      {/* 同心格線 */}
      {rings.map((p) => (
        <polygon
          key={p}
          points={Array.from({ length: n }, (_, i) => pt(p, i).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-border/50"
          strokeWidth={1}
        />
      ))}
      {/* 軸線 + 標籤 */}
      {labels.map((lab, i) => {
        const [x, y] = pt(100, i);
        const [lx, ly] = (() => {
          const r = R + 16;
          return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
        })();
        const cos = Math.cos(angle(i));
        const anchor = Math.abs(cos) < 0.3 ? "middle" : cos > 0 ? "start" : "end";
        return (
          <g key={lab}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-border/40" strokeWidth={1} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {lab.length > 12 ? `${lab.slice(0, 11)}…` : lab}
            </text>
          </g>
        );
      })}
      {/* B 在下、A 在上(半透明填色 + 描邊) */}
      <polygon points={polygon(bVals)} fill={COLOR_B} fillOpacity={0.18} stroke={COLOR_B} strokeWidth={2} />
      <polygon points={polygon(aVals)} fill={COLOR_A} fillOpacity={0.18} stroke={COLOR_A} strokeWidth={2} />
    </svg>
  );
}

/* --------------------------- 逐題對比卡片 --------------------------- */

function statusTone(status: number | null): { label: string; cls: string } {
  switch (statusKind(status)) {
    case "pass":
      return { label: "通過", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" };
    case "half":
      return { label: "半對", cls: "text-amber-300 border-amber-400/30 bg-amber-400/10" };
    case "fail":
      return { label: "未過", cls: "text-red-300 border-red-400/30 bg-red-400/10" };
    default:
      return { label: "未測", cls: "text-muted-foreground border-border/50 bg-muted/40" };
  }
}

function SideStatus({ side, color, status }: { side: string; color: string; status: number | null }) {
  const t = statusTone(status);
  return (
    <div className={cn("flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1", t.cls)}>
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {side}
      </span>
      <span className="font-semibold">{t.label}</span>
    </div>
  );
}

function ScenarioCard({
  sid,
  q,
  aStatus,
  bStatus
}: {
  sid: string;
  q: ExamPack["scenarios"][string] | undefined;
  aStatus: number | null;
  bStatus: number | null;
}) {
  return (
    <div className="bg-card/50 border-border/60 flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <span className="font-data bg-muted shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold">{sid}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={q?.title}>
          {q?.title ?? sid}
        </span>
        {q?.category ? (
          <span className="text-muted-foreground shrink-0 text-[10px] tracking-wide uppercase">{q.category}</span>
        ) : null}
      </div>
      {q?.prompt ? <p className="text-muted-foreground text-xs leading-relaxed">{q.prompt}</p> : null}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <SideStatus side="A" color={COLOR_A} status={aStatus} />
        <SideStatus side="B" color={COLOR_B} status={bStatus} />
      </div>
    </div>
  );
}

/* ------------------------------ 主頁面 ------------------------------ */

export default function Compare() {
  const { db, loading, error } = useDb();
  const [sp, setSp] = useSearchParams();
  const packs = useMemo(() => (db ? getPacks(db) : []), [db]);

  const packName = sp.get("pack");
  const packVer = sp.get("ver");

  useEffect(() => {
    if (db && packs.length && (!packName || !packVer)) {
      const p = packs[0];
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("pack", p.name);
          n.set("ver", p.ver);
          return n;
        },
        { replace: true }
      );
    }
  }, [db, packs, packName, packVer, setSp]);

  const rows = useMemo(
    () => (db && packName && packVer ? getSubmissionsByPack(db, packName, packVer) : []),
    [db, packName, packVer]
  );
  const byId = useMemo(() => new Map(rows.map((r) => [String(r.id), r])), [rows]);
  const a = byId.get(sp.get("a") ?? "") ?? null;
  const b = byId.get(sp.get("b") ?? "") ?? null;

  // 系列只是大篩選器(避免選項過多),左右各自獨立,可比不同系列。
  const families = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.familyName && s.add(r.familyName));
    return [...s].sort();
  }, [rows]);
  // 系列 → 代表性廠牌(取該系列第一筆的 org / 頭像)當作系列圖示。
  const familyMeta = useMemo(() => {
    const m = new Map<string, { org: string | null; avatar: string | null }>();
    for (const r of rows) {
      if (r.familyName && !m.has(r.familyName)) m.set(r.familyName, { org: r.modelOrg, avatar: r.orgAvatar });
    }
    return m;
  }, [rows]);
  const [famA, setFamA] = useState("__all__");
  const [famB, setFamB] = useState("__all__");

  // 換 pack 時候選清單會變,重置兩側系列篩選。
  useEffect(() => {
    setFamA("__all__");
    setFamB("__all__");
  }, [packName, packVer]);

  const candidatesFor = (fam: string) =>
    fam === "__all__" ? rows : rows.filter((r) => r.familyName === fam);

  const setSide = (side: "a" | "b", id: string) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.set(side, id);
      return n;
    });

  // 切換系列:更新該側系列篩選,若已選模型不屬於新系列就一併 reset。
  const changeFamily = (side: "a" | "b", fam: string) => {
    (side === "a" ? setFamA : setFamB)(fam);
    const cur = side === "a" ? a : b;
    if (cur && fam !== "__all__" && cur.familyName !== fam) {
      setSp((prev) => {
        const n = new URLSearchParams(prev);
        n.delete(side);
        return n;
      });
    }
  };

  const setPack = (name: string, ver: string) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.set("pack", name);
      n.set("ver", ver);
      n.delete("a");
      n.delete("b");
      return n;
    });

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 忽略 */
    }
  };

  // 題庫(題目說明 + 評分標準),逐題對比用。
  const [exam, setExam] = useState<ExamPack | null>(null);
  useEffect(() => {
    let alive = true;
    if (packName && packVer) loadExam(packName, packVer).then((e) => alive && setExam(e));
    else setExam(null);
    return () => {
      alive = false;
    };
  }, [packName, packVer]);

  // A / B 的逐題結果,對齊成卡片資料。
  const aResults = useMemo(() => (db && a ? getResults(db, a.id) : []), [db, a]);
  const bResults = useMemo(() => (db && b ? getResults(db, b.id) : []), [db, b]);
  const scenarioRows = useMemo(() => {
    if (!a || !b) return [];
    const bMap = new Map(bResults.map((r) => [r.scenarioId, r.status]));
    return aResults.map((r) => ({
      sid: r.scenarioId,
      q: exam?.scenarios[r.scenarioId],
      aStatus: r.status,
      bStatus: bMap.get(r.scenarioId) ?? null
    }));
  }, [a, b, aResults, bResults, exam]);

  // 類別(兩邊同 pack → 一致),以 A 的順序對齊 B。
  const cats = useMemo(() => {
    if (!a || !b) return [] as { label: string; a: number; b: number }[];
    const bById = new Map(b.scoreCats.map((c) => [c.id, c]));
    return a.scoreCats.map((c) => ({
      label: c.label ?? c.id,
      a: c.score,
      b: bById.get(c.id)?.score ?? 0
    }));
  }, [a, b]);

  const metrics: Metric[] = useMemo(() => {
    if (!a || !b) return [];
    return [
      { label: "總分", a: a.scoreTotal, b: b.scoreTotal, fmt: (v) => v.toFixed(1), max: 100, higherBetter: true },
      ...cats.map((c) => ({
        label: c.label,
        a: c.a,
        b: c.b,
        fmt: (v: number) => v.toFixed(0),
        max: 100,
        higherBetter: true
      })),
      {
        label: "通過率",
        a: a.totalCount ? ((a.passCount + a.halfCount * 0.5) / a.totalCount) * 100 : null,
        b: b.totalCount ? ((b.passCount + b.halfCount * 0.5) / b.totalCount) * 100 : null,
        fmt: (v) => `${v.toFixed(0)}%`,
        max: 100,
        higherBetter: true
      },
      {
        label: "平均每題",
        a: avgTime(a),
        b: avgTime(b),
        fmt: fmtSec,
        max: Math.max(avgTime(a) || 0, avgTime(b) || 0) || 1,
        higherBetter: false
      }
    ];
  }, [a, b, cats]);

  return (
    <main className="mx-auto max-w-[900px] px-4 pt-10 pb-20 sm:pt-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          <GitCompareArrows className="text-primary size-7 sm:size-8" />
          模型對比
        </h1>
        <button
          type="button"
          onClick={copyLink}
          className="text-muted-foreground hover:text-foreground hover:border-primary/50 border-border/60 bg-card/50 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
        >
          {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
          {copied ? "已複製連結" : "複製連結"}
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
          <Loader2 className="size-4 animate-spin" />
          載入資料庫中…
        </div>
      ) : error ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-xl border p-6 text-center text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* 測試(pack)共用 */}
          {packs.length > 0 ? (
            <div className="mb-4">
              <PackSelect
                packs={packs}
                value={packName && packVer ? { name: packName, ver: packVer } : null}
                onChange={(p) => setPack(p.name, p.ver)}
              />
            </div>
          ) : null}

          {/* 左右選擇器:各自有系列篩選(大分類)+ 模型選擇,可比不同系列 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {(["a", "b"] as const).map((side) => {
              const value = side === "a" ? a : b;
              const color = side === "a" ? COLOR_A : COLOR_B;
              const fam = side === "a" ? famA : famB;
              const candidates = candidatesFor(fam);
              return (
                <div key={side} className="flex min-w-0 flex-col gap-1.5">
                  {families.length > 0 ? (
                    <Select value={fam} onValueChange={(f) => changeFamily(side, f)}>
                      <SelectTrigger
                        aria-label={`${side.toUpperCase()} 系列篩選`}
                        className="text-muted-foreground hover:text-foreground w-full rounded-lg py-1.5 text-xs"
                      >
                        <SelectValue className="min-w-0 flex-1 text-left" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">
                          <span className="flex min-w-0 items-center gap-2">
                            <Layers className="size-3.5 shrink-0 opacity-70" />
                            <span className="truncate">全部系列</span>
                          </span>
                        </SelectItem>
                        {families.map((f) => {
                          const meta = familyMeta.get(f);
                          return (
                            <SelectItem key={f} value={f}>
                              <span className="flex min-w-0 items-center gap-2">
                                <OrgLogo org={meta?.org ?? f} avatar={meta?.avatar ?? null} size={18} radius="rounded-md" />
                                <span className="truncate">{f}</span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <Select
                    value={value ? String(value.id) : undefined}
                    onValueChange={(id) => setSide(side, id)}
                  >
                    <SelectTrigger aria-label={`選擇模型 ${side.toUpperCase()}`} className="w-full">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <SelectValue placeholder={`模型 ${side.toUpperCase()}…`} className="min-w-0 flex-1 text-left text-sm font-semibold" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 確保已選的也在清單內(即使被系列篩掉) */}
                      {Array.from(new Set([...(value ? [value] : []), ...candidates])).map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{r.modelName}</span>
                            {r.linkAuthor ? (
                              <span className="text-muted-foreground shrink-0 text-xs">· {r.linkAuthor}</span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                      {candidates.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-1.5 text-xs">無符合的模型</div>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {/* 身分卡 */}
          {a && b ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
              <IdentityCard row={a} color={COLOR_A} side="A" />
              <IdentityCard row={b} color={COLOR_B} side="B" />
            </div>
          ) : null}

          {/* 雷達圖 + 對比長條 */}
          {a && b ? (
            <>
              {cats.length >= 3 ? (
                <div className="bg-card/50 border-border/60 mt-6 rounded-2xl border p-4 sm:p-6">
                  <Radar
                    labels={cats.map((c) => c.label)}
                    aVals={cats.map((c) => c.a)}
                    bVals={cats.map((c) => c.b)}
                  />
                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_A }} />
                      <span className="truncate">{a.modelName}</span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_B }} />
                      <span className="truncate">{b.modelName}</span>
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="bg-card/50 border-border/60 mt-4 rounded-2xl border p-4 sm:p-6">
                {metrics.map((m) => (
                  <VersusBar key={m.label} m={m} />
                ))}
              </div>

              {/* 逐題對比:題目說明 + 評分標準 + A/B 結果(放最下,RWD 卡片) */}
              {scenarioRows.length > 0 ? (
                <section className="mt-8">
                  <h2 className="font-display text-lg font-bold">逐題對比</h2>
                  <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
                    每題的測試重點與評分標準,以及 A / B 各自的結果
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {scenarioRows.map((s) => (
                      <ScenarioCard
                        key={s.sid}
                        sid={s.sid}
                        q={s.q}
                        aStatus={s.aStatus}
                        bStatus={s.bStatus}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground/70 mt-6 text-center text-sm">
              在上方左右各選一個模型即可對比 · 可用「系列」縮小清單 · 選好後「複製連結」分享
            </p>
          )}
        </>
      )}
    </main>
  );
}
