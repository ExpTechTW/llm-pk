import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, GitCompareArrows, Loader2, Search } from "lucide-react";

import { OrgLogo } from "@/components/ui/org-logo";
import { PackSelect } from "@/components/PackSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { getPacks, getSubmissionsByPack } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import { modelBadges } from "@/lib/badges";
import { avgTime } from "@/lib/filters";
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
        <div className="text-muted-foreground/70 truncate text-xs">@{row.uploader}</div>
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

  // 初步篩選:系列 + 文字搜尋(縮小兩個選擇器的候選清單)。
  const [family, setFamily] = useState<string>("__all__");
  const [query, setQuery] = useState("");
  const families = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.familyName && s.add(r.familyName));
    return [...s].sort();
  }, [rows]);

  // 換 pack 時候選清單會變,重置篩選。
  useEffect(() => {
    setFamily("__all__");
    setQuery("");
  }, [packName, packVer]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (family !== "__all__" && r.familyName !== family) return false;
      if (q && !`${r.modelName} ${r.uploader}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, family, query]);

  const setSide = (side: "a" | "b", id: string) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.set(side, id);
      return n;
    });

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
          {/* 初步篩選:測試 + 系列 + 搜尋 */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {packs.length > 0 ? (
              <PackSelect
                packs={packs}
                value={packName && packVer ? { name: packName, ver: packVer } : null}
                onChange={(p) => setPack(p.name, p.ver)}
              />
            ) : null}
            {families.length > 0 ? (
              <Select value={family} onValueChange={setFamily}>
                <SelectTrigger aria-label="依系列篩選" className="sm:w-44">
                  <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">系列</span>
                  <SelectValue className="text-sm font-semibold" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部系列</SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <div className="border-border/60 bg-card/50 flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 sm:min-w-48">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋模型 / 上傳者…"
                className="placeholder:text-muted-foreground/60 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          {/* 左右選擇器 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {(["a", "b"] as const).map((side) => {
              const value = side === "a" ? a : b;
              const color = side === "a" ? COLOR_A : COLOR_B;
              return (
                <Select
                  key={side}
                  value={value ? String(value.id) : undefined}
                  onValueChange={(id) => setSide(side, id)}
                >
                  <SelectTrigger aria-label={`選擇模型 ${side.toUpperCase()}`} className="w-full">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <SelectValue placeholder={`選擇模型 ${side.toUpperCase()}…`} className="truncate text-sm font-semibold" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 確保已選的也在清單內(即使被篩掉) */}
                    {Array.from(new Set([...(value ? [value] : []), ...candidates])).map((r) => (
                      <SelectItem key={r.id} value={String(r.id)} className="font-medium">
                        {r.modelName}
                        <span className="text-muted-foreground ml-1 font-normal">@{r.uploader}</span>
                      </SelectItem>
                    ))}
                    {candidates.length === 0 ? (
                      <div className="text-muted-foreground px-2 py-1.5 text-xs">無符合的模型</div>
                    ) : null}
                  </SelectContent>
                </Select>
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
                  <div className="text-muted-foreground mt-2 flex items-center justify-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_A }} />
                      {a.modelName}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_B }} />
                      {b.modelName}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="bg-card/50 border-border/60 mt-4 rounded-2xl border p-4 sm:p-6">
                {metrics.map((m) => (
                  <VersusBar key={m.label} m={m} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground/70 mt-6 text-center text-sm">
              在上方左右各選一個模型即可對比 · 可用「系列 / 搜尋」縮小清單 · 選好後「複製連結」分享
            </p>
          )}
        </>
      )}
    </main>
  );
}
