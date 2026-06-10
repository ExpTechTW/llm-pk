import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";

import { CompareBar, CompareCheck, CompareDialog, COMPARE_MAX } from "@/components/Compare";
import { FilterSidebar } from "@/components/FilterSidebar";
import { PackSelect, type PackKey } from "@/components/PackSelect";
import { SearchBar } from "@/components/SearchBar";
import { SubmissionCard } from "@/components/SubmissionCard";
import { Button } from "@/components/ui/button";
import { getPacks, getSubmissionsByPack } from "@/lib/db";
import type { SubmissionRow } from "@/lib/types";
import {
  applyFilters,
  computeBounds,
  computeFacets,
  countRangeActive,
  countSelected,
  emptySelected,
  PRICE_FIELDS,
  SIZE_FIELDS,
  type Range,
  type Ranges,
  type Selected,
  type SortKey
} from "@/lib/filters";
import { useDb } from "@/hooks/useDb";
import { usePrices } from "@/hooks/usePrices";
import { priceKey } from "@/lib/price";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

export default function Leaderboard() {
  const { db, loading, error } = useDb();
  const [pack, setPack] = useState<PackKey | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected>(emptySelected);
  const [sort, setSort] = useState<SortKey>("score");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<number>>(() => new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const prices = usePrices();
  const packs = useMemo(() => (db ? getPacks(db) : []), [db]);
  const rows = useMemo(() => {
    const base = db && pack ? getSubmissionsByPack(db, pack.name, pack.ver) : [];
    // 依 model id / name 比對 price.csv,補上價格(供「價格」篩選使用)
    return base.map((r) => {
      const p =
        (r.modelId ? prices.get(priceKey(r.modelId)) : undefined) ?? prices.get(priceKey(r.modelName));
      return p
        ? { ...r, priceInput: p.input, priceCacheInput: p.cacheInput, priceOutput: p.output }
        : r;
    });
  }, [db, pack, prices]);
  const priceBounds = useMemo(() => computeBounds(rows, PRICE_FIELDS), [rows]);
  const [priceRanges, setPriceRanges] = useState<Ranges>({});
  const sizeBounds = useMemo(() => computeBounds(rows, SIZE_FIELDS), [rows]);
  const [sizeRanges, setSizeRanges] = useState<Ranges>({});

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const compareRows = useMemo(
    () => [...compareIds].map((cid) => rowById.get(cid)).filter((r): r is SubmissionRow => !!r),
    [compareIds, rowById]
  );

  const facets = useMemo(() => computeFacets(rows, search, selected), [rows, search, selected]);
  const filtered = useMemo(
    () => applyFilters(rows, search, selected, sort, priceRanges, priceBounds, sizeRanges, sizeBounds),
    [rows, search, selected, sort, priceRanges, priceBounds, sizeRanges, sizeBounds]
  );

  useEffect(() => {
    if (!pack && packs.length > 0) setPack({ name: packs[0].name, ver: packs[0].ver });
  }, [packs, pack]);

  // 區間預設為各欄位的完整範圍(換 pack / 資料載入後重置)
  useEffect(() => {
    setPriceRanges({ ...priceBounds });
  }, [priceBounds]);
  useEffect(() => {
    setSizeRanges({ ...sizeBounds });
  }, [sizeBounds]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [pack, search, selected, sort, priceRanges, sizeRanges]);

  const changePack = (next: PackKey) => {
    setPack(next);
    setSelected(emptySelected());
    setCompareIds(new Set());
    setCompareOpen(false);
  };

  const toggleCompare = (cid: number) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else if (next.size < COMPARE_MAX) next.add(cid);
      return next;
    });
  };

  const toggle = (facetKey: string, value: string) => {
    setSelected((prev) => {
      const next: Selected = { ...prev };
      const set = new Set(next[facetKey]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[facetKey] = set;
      return next;
    });
  };

  const changeSize = (key: string, range: Range) => {
    setSizeRanges((prev) => ({ ...prev, [key]: range }));
  };

  const changePrice = (key: string, range: Range) => {
    setPriceRanges((prev) => ({ ...prev, [key]: range }));
    // 價格只有雲端模型才有 → 一旦縮小某個價格區間,自動勾選「部署:雲端」
    const bound = priceBounds[key];
    const narrowed = bound && (range[0] > bound[0] || range[1] < bound[1]);
    if (narrowed) {
      setSelected((prev) => {
        if (prev.deployment?.has("雲端")) return prev;
        const next: Selected = { ...prev };
        next.deployment = new Set(next.deployment ?? []).add("雲端");
        return next;
      });
    }
  };

  const resetAll = () => {
    setSelected(emptySelected());
    setPriceRanges({ ...priceBounds });
    setSizeRanges({ ...sizeBounds });
  };

  const activeFilters =
    countSelected(selected) +
    countRangeActive(priceRanges, priceBounds, PRICE_FIELDS) +
    countRangeActive(sizeRanges, sizeBounds, SIZE_FIELDS);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pt-10 pb-20 sm:pt-14">
      {/* 整合式標題列 + 工具列 */}
      <div className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <span className="border-border/60 bg-card/50 text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <span className="bg-primary size-1.5 animate-pulse rounded-full" />
            BenchLocal 社群跑分
          </span>
          <h1 className="font-display text-4xl leading-[1.03] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            本地模型{" "}
            <span className="from-primary bg-gradient-to-r to-cyan-300 bg-clip-text text-transparent">
              跑分排行榜
            </span>
          </h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          {packs.length > 0 ? (
            <PackSelect packs={packs} value={pack} onChange={changePack} />
          ) : null}
          <div className="w-full sm:w-80">
            <SearchBar value={search} onChange={setSearch} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
          <Loader2 className="size-4 animate-spin" />
          載入資料庫中…
        </div>
      ) : error ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mx-auto max-w-md rounded-xl border p-6 text-center text-sm">
          <p className="font-medium">無法載入排行榜</p>
          <p className="mt-1 opacity-80">{error}</p>
          <p className="text-muted-foreground mt-3 text-xs">
            請先執行 <code className="font-mono">npm run build:db</code> 產生 public/data.db。
          </p>
        </div>
      ) : !db || packs.length === 0 ? (
        <div className="text-muted-foreground mx-auto max-w-md rounded-xl border p-10 text-center text-sm">
          目前沒有任何投稿資料。把 score.json 放進{" "}
          <code className="font-mono">data/&#123;pack&#125;/&#123;ver&#125;/</code> 後重新建置即可。
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[256px_minmax(0,1fr)] lg:gap-8">
          {/* 篩選側欄(桌面:sticky 固定,不隨清單滾動;過長時內部捲動) */}
          <aside className="lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
            <div className="mb-3 lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
                className="w-full"
              >
                <SlidersHorizontal className="size-4" />
                篩選與排序{activeFilters > 0 ? ` · ${activeFilters}` : ""}
              </Button>
            </div>
            <div
              className={cn(
                "border-border/60 bg-card/40 rounded-xl border p-4",
                showFilters ? "block" : "hidden lg:block"
              )}
            >
              <FilterSidebar
                facets={facets}
                selected={selected}
                onToggle={toggle}
                onReset={resetAll}
                sort={sort}
                onSortChange={setSort}
                priceBounds={priceBounds}
                priceRanges={priceRanges}
                onPriceChange={changePrice}
                sizeBounds={sizeBounds}
                sizeRanges={sizeRanges}
                onSizeChange={changeSize}
              />
            </div>
          </aside>

          {/* 排行清單(概覽) */}
          <div className="flex flex-col gap-3">
            <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
              <span>
                {search.trim() || activeFilters > 0 ? "符合條件" : "全部投稿"} {filtered.length} 筆
              </span>
              <span>共 {rows.length} 筆</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-muted-foreground border-border/60 rounded-2xl border border-dashed py-16 text-center text-sm">
                找不到符合條件的投稿。
              </div>
            ) : (
              <>
                {filtered.slice(0, visible).map((row, index) => {
                  const checked = compareIds.has(row.id);
                  return (
                    <div key={row.id} className="flex items-center gap-2 sm:gap-3">
                      <CompareCheck
                        checked={checked}
                        disabled={!checked && compareIds.size >= COMPARE_MAX}
                        onToggle={() => toggleCompare(row.id)}
                        label={row.modelName}
                      />
                      <div className="min-w-0 flex-1">
                        <SubmissionCard row={row} rank={index + 1} index={index} />
                      </div>
                    </div>
                  );
                })}
                {filtered.length > visible ? (
                  <Button
                    variant="outline"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="mt-2 self-center rounded-full"
                  >
                    顯示更多 {filtered.length - visible} 筆
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {/* 比較:底部浮動列 + 並排比較對話框 */}
      {compareRows.length > 0 ? <div className="h-20" aria-hidden /> : null}
      <CompareBar
        rows={compareRows}
        onRemove={toggleCompare}
        onClear={() => {
          setCompareIds(new Set());
          setCompareOpen(false);
        }}
        onOpen={() => setCompareOpen(true)}
      />
      <CompareDialog
        rows={compareRows}
        open={compareOpen && compareRows.length >= 2}
        onOpenChange={setCompareOpen}
        onRemove={toggleCompare}
      />
    </main>
  );
}
