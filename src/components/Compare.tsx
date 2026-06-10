import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, GitCompare, ListFilter, X } from "lucide-react";

import { OrgLogo } from "@/components/ui/org-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatPass } from "@/lib/status";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const COMPARE_MAX = 4;

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function isCloud(r: SubmissionRow): boolean {
  return r.deployment === "cloud";
}

/** 每列比較指標:display 給文字,num 給可比較的數值(供標出最佳)。 */
interface Metric {
  key: string;
  label: string;
  display: (r: SubmissionRow) => string;
  num?: (r: SubmissionRow) => number | null;
  better?: "max" | "min";
}

const BASE_METRICS: Metric[] = [
  {
    key: "score",
    label: "總分",
    display: (r) => r.scoreTotal.toFixed(1),
    num: (r) => r.scoreTotal,
    better: "max"
  },
  {
    key: "pass",
    label: "通過題數",
    display: (r) => `${formatPass(r.passCount, r.halfCount)} / ${r.totalCount}`,
    num: (r) => (r.totalCount ? (r.passCount + r.halfCount * 0.5) / r.totalCount : null),
    better: "max"
  },
  {
    key: "avgtime",
    label: "平均每題",
    display: (r) => formatTime(r.totalCount ? r.totalTime / r.totalCount : 0),
    num: (r) => (r.totalCount ? r.totalTime / r.totalCount : null),
    better: "min"
  },
  {
    key: "deploy",
    label: "部署",
    display: (r) => (isCloud(r) ? "雲端" : "本地")
  },
  {
    key: "params",
    label: "參數",
    display: (r) => r.sizeParams ?? "—"
  },
  {
    key: "active",
    label: "啟動參數",
    display: (r) => r.sizeActive ?? "—"
  },
  {
    key: "quant",
    label: "量化",
    display: (r) => [r.quantFormat, r.quantLevel, r.quantMethod].filter(Boolean).join(" · ") || "—"
  },
  {
    key: "backend",
    label: "後端",
    display: (r) => `${r.backendName}${r.backendVer ? ` ${r.backendVer}` : ""}`
  },
  {
    key: "hardware",
    label: "硬體",
    display: (r) => [r.hwCompany, r.hwDevice].filter(Boolean).join(" · ") || "—"
  },
  {
    key: "price",
    label: "輸出價格 / 1M",
    display: (r) => (r.priceOutput != null ? `$${r.priceOutput}` : "—"),
    num: (r) => r.priceOutput,
    better: "min"
  }
];

// 各模型的分類分數聯集成列(以出現順序排列)。
function categoryMetrics(rows: SubmissionRow[]): Metric[] {
  const order: string[] = [];
  const label = new Map<string, string>();
  for (const r of rows) {
    for (const c of r.scoreCats) {
      if (!label.has(c.id)) {
        order.push(c.id);
        label.set(c.id, c.label ?? c.id);
      }
    }
  }
  return order.map((id) => ({
    key: `cat:${id}`,
    label: label.get(id) ?? id,
    display: (r) => {
      const c = r.scoreCats.find((x) => x.id === id);
      return c ? String(c.score) : "—";
    },
    num: (r) => r.scoreCats.find((x) => x.id === id)?.score ?? null,
    better: "max"
  }));
}

// 該列的最佳值(若全部相同則回 null,表示不標示)。
function bestOf(metric: Metric, rows: SubmissionRow[]): number | null {
  if (!metric.num || !metric.better) return null;
  const vals = rows.map((r) => metric.num!(r)).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const best = metric.better === "max" ? Math.max(...vals) : Math.min(...vals);
  if (vals.every((v) => v === best)) return null; // 全部相同 → 不標示
  return best;
}

function Row({
  metric,
  rows,
  diffOnly
}: {
  metric: Metric;
  rows: SubmissionRow[];
  diffOnly: boolean;
}) {
  const displays = rows.map((r) => metric.display(r));
  const allSame = displays.every((d) => d === displays[0]);
  if (diffOnly && allSame) return null;

  const best = bestOf(metric, rows);
  return (
    <tr className="border-border/50 border-t">
      <th
        scope="row"
        className="bg-card text-muted-foreground sticky left-0 z-10 py-2.5 pr-3 pl-4 text-left text-xs font-medium whitespace-nowrap"
      >
        {metric.label}
      </th>
      {rows.map((r, i) => {
        const isBest = best != null && metric.num?.(r) === best;
        return (
          <td
            key={r.id}
            className={cn(
              "px-3 py-2.5 text-sm whitespace-nowrap tabular-nums",
              isBest ? "text-primary font-semibold" : "text-foreground/90"
            )}
          >
            <span className={cn(isBest && "bg-primary/10 -mx-1 rounded px-1 py-0.5")}>
              {displays[i]}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

/** 比較對話框:左欄指標、各模型一欄並排,每列標出最佳值。 */
export function CompareDialog({
  rows,
  open,
  onOpenChange,
  onRemove
}: {
  rows: SubmissionRow[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRemove: (id: number) => void;
}) {
  const [diffOnly, setDiffOnly] = useState(false);
  const metrics = useMemo(() => {
    const cats = categoryMetrics(rows);
    // 把分類分數插在「平均每題」之後、規格之前,語意上分數歸一區塊
    const head = BASE_METRICS.slice(0, 3);
    const tail = BASE_METRICS.slice(3).filter((m) => m.key !== "price" || rows.some((r) => r.priceOutput != null));
    return [...head, ...cats, ...tail];
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,76rem)] gap-0 overflow-hidden p-0">
        <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 pr-14">
          <div className="flex flex-col gap-1">
            <h2 className="font-display flex items-center gap-2 text-lg leading-tight font-bold">
              <GitCompare className="text-primary size-4" />
              模型比較
            </h2>
            <p className="text-muted-foreground text-xs">
              並排比較 {rows.length} 個模型,綠色標示為該列最佳。
            </p>
          </div>
          <Button
            variant={diffOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setDiffOnly((v) => !v)}
            aria-pressed={diffOnly}
            className="rounded-lg"
          >
            <ListFilter className="size-3.5" />
            只顯示差異
          </Button>
        </div>

        <div className="max-h-[74vh] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="bg-card sticky top-0 left-0 z-30 w-32 min-w-32" />
                {rows.map((r) => (
                  <th
                    key={r.id}
                    className="bg-card sticky top-0 z-20 min-w-44 px-3 pt-4 pb-3 align-top font-normal"
                  >
                    <div className="flex items-start gap-2.5">
                      <OrgLogo org={r.modelOrg} avatar={r.orgAvatar} size={34} radius="rounded-lg" />
                      <div className="flex min-w-0 flex-col">
                        <span className="text-foreground truncate text-sm font-bold" title={r.modelName}>
                          {r.modelName}
                        </span>
                        <span className="text-muted-foreground truncate text-[11px]">@{r.uploader}</span>
                        <span className="font-data text-primary mt-1 text-xl leading-none font-bold tabular-nums">
                          {r.scoreTotal.toFixed(1)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(r.id)}
                        title="移除"
                        className="text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 -mt-1 ml-auto rounded p-0.5"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <Row key={m.key} metric={m} rows={rows} diffOnly={diffOnly} />
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 底部浮動比較列:顯示已選模型,可移除/清除/開啟比較。 */
export function CompareBar({
  rows,
  onRemove,
  onClear,
  onOpen
}: {
  rows: SubmissionRow[];
  onRemove: (id: number) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="animate-rise fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="border-border/70 bg-card/95 flex max-w-full items-center gap-3 rounded-2xl border p-2 pl-3 shadow-2xl shadow-black/40 backdrop-blur">
        <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
          比較 {rows.length}/{COMPARE_MAX}
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {rows.map((r) => (
            <span
              key={r.id}
              className="border-border/60 bg-background/60 flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-1 pl-1.5"
            >
              <OrgLogo org={r.modelOrg} avatar={r.orgAvatar} size={18} radius="rounded-full" />
              <span className="max-w-28 truncate text-xs font-medium">{r.modelName}</span>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                title="移除"
                className="text-muted-foreground/70 hover:text-foreground hover:bg-muted/70 rounded-full p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground shrink-0 px-1 text-xs"
        >
          清除
        </button>
        <Button size="sm" onClick={onOpen} disabled={rows.length < 2} className="shrink-0 rounded-xl">
          比較
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** 卡片左側的比較勾選框。 */
export function CompareCheck({
  checked,
  disabled,
  onToggle,
  label
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? `最多比較 ${COMPARE_MAX} 個` : checked ? "取消比較" : "加入比較"}
      aria-pressed={checked}
      aria-label={`${checked ? "取消比較" : "加入比較"} ${label}`}
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/70 text-transparent hover:border-primary/60",
        disabled && "cursor-not-allowed opacity-40 hover:border-border/70"
      )}
    >
      <CheckMark />
    </button>
  );
}

function CheckMark(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
