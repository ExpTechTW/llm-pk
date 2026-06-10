import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, GitCompareArrows, Loader2 } from "lucide-react";

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

const SIDES = ["a", "b"] as const;
type Side = (typeof SIDES)[number];

function fmtSec(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

// 單側的選擇器 + 模型身分卡。
function ModelColumn({
  rows,
  value,
  onChange,
  side
}: {
  rows: SubmissionRow[];
  value: SubmissionRow | null;
  onChange: (id: string) => void;
  side: Side;
}) {
  const badges = value ? modelBadges(value) : [];
  return (
    <div className="flex flex-col gap-3">
      <Select value={value ? String(value.id) : undefined} onValueChange={onChange}>
        <SelectTrigger aria-label={`選擇模型 ${side.toUpperCase()}`} className="w-full">
          <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">
            {side === "a" ? "A" : "B"}
          </span>
          <SelectValue placeholder="選擇模型…" className="truncate text-sm font-semibold" />
        </SelectTrigger>
        <SelectContent>
          {rows.map((r) => (
            <SelectItem key={r.id} value={String(r.id)} className="font-medium">
              {r.modelName}
              <span className="text-muted-foreground ml-1 font-normal">@{r.uploader}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value ? (
        <div className="bg-card/70 border-border/60 flex flex-col items-center gap-3 rounded-2xl border p-4 text-center">
          <OrgLogo org={value.modelOrg} avatar={value.orgAvatar} size={56} radius="rounded-2xl" />
          <div className="min-w-0">
            <div
              className="font-display truncate text-base leading-tight font-bold sm:text-lg"
              title={value.modelName}
            >
              {value.modelName}
            </div>
            <div className="text-muted-foreground/70 truncate text-xs">@{value.uploader}</div>
          </div>
          <div className="font-data text-3xl leading-none font-bold tabular-nums sm:text-4xl">
            {value.scoreTotal.toFixed(1)}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {badges.map((bdg) => (
              <span
                key={bdg.label}
                className={cn(
                  "border-border/70 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                  bdg.className
                )}
              >
                <bdg.Icon className="size-3" />
                {bdg.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-border/50 text-muted-foreground/60 flex h-44 items-center justify-center rounded-2xl border border-dashed text-sm">
          尚未選擇
        </div>
      )}
    </div>
  );
}

// 一列對比指標:左 A、中標籤、右 B,較佳者高亮。
function MetricRow({
  label,
  a,
  b,
  fmt,
  higherBetter = true
}: {
  label: string;
  a: number | null;
  b: number | null;
  fmt: (v: number) => string;
  higherBetter?: boolean;
}) {
  const both = a != null && b != null && a !== b;
  const aWin = both && (higherBetter ? (a as number) > (b as number) : (a as number) < (b as number));
  const bWin = both && (higherBetter ? (b as number) > (a as number) : (b as number) < (a as number));
  return (
    <div className="border-border/40 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b py-2 last:border-0">
      <div className={cn("font-data text-right tabular-nums", aWin ? "text-primary font-bold" : "text-foreground/90")}>
        {a != null ? fmt(a) : "—"}
      </div>
      <div className="text-muted-foreground px-1 text-center text-[11px] tracking-wide sm:text-xs">{label}</div>
      <div className={cn("font-data text-left tabular-nums", bWin ? "text-primary font-bold" : "text-foreground/90")}>
        {b != null ? fmt(b) : "—"}
      </div>
    </div>
  );
}

export default function Compare() {
  const { db, loading, error } = useDb();
  const [sp, setSp] = useSearchParams();
  const packs = useMemo(() => (db ? getPacks(db) : []), [db]);

  const packName = sp.get("pack");
  const packVer = sp.get("ver");

  // 預設帶入第一個 pack
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

  const setSide = (side: Side, id: string) =>
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
      n.delete("a"); // 換 pack 後原本選的模型多半不在新 pack,清掉
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
      /* 忽略(瀏覽器不支援 / 未授權) */
    }
  };

  // 兩邊同 pack → 類別一致,以 A 的類別為主軸對齊 B。
  const categories = useMemo(() => {
    if (!a || !b) return [];
    const bById = new Map(b.scoreCats.map((c) => [c.id, c]));
    return a.scoreCats.map((c) => ({
      label: c.label ?? c.id,
      a: c.score,
      b: bById.get(c.id)?.score ?? null
    }));
  }, [a, b]);

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
          <div className="mb-5">
            {packs.length > 0 ? (
              <PackSelect
                packs={packs}
                value={packName && packVer ? { name: packName, ver: packVer } : null}
                onChange={(p) => setPack(p.name, p.ver)}
              />
            ) : null}
          </div>

          {/* 左右選擇 + 身分卡(手機也並排,方便對比) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <ModelColumn rows={rows} value={a} onChange={(id) => setSide("a", id)} side="a" />
            <ModelColumn rows={rows} value={b} onChange={(id) => setSide("b", id)} side="b" />
          </div>

          {/* 指標對比 */}
          {a && b ? (
            <div className="bg-card/50 border-border/60 mt-6 rounded-2xl border p-4 sm:p-6">
              <MetricRow label="總分" a={a.scoreTotal} b={b.scoreTotal} fmt={(v) => v.toFixed(1)} />
              {categories.map((c) => (
                <MetricRow key={c.label} label={c.label} a={c.a} b={c.b} fmt={(v) => v.toFixed(0)} />
              ))}
              <MetricRow
                label="通過題數"
                a={a.passCount}
                b={b.passCount}
                fmt={(v) => `${v}/${a.totalCount}`}
              />
              <MetricRow
                label="平均每題"
                a={avgTime(a)}
                b={avgTime(b)}
                fmt={fmtSec}
                higherBetter={false}
              />
            </div>
          ) : (
            <p className="text-muted-foreground/70 mt-6 text-center text-sm">
              在上方左右各選一個模型即可對比 · 選好後可「複製連結」分享
            </p>
          )}
        </>
      )}
    </main>
  );
}
