import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, SlidersHorizontal } from "lucide-react";

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
  parseSize,
  PRICE_FIELDS,
  SIZE_FIELDS,
  type Range,
  type Ranges,
  type Selected,
  type SortKey
} from "@/lib/filters";
import { useDb } from "@/hooks/useDb";
import { useI18n } from "@/lib/i18n";
import { usePrices } from "@/hooks/usePrices";
import { priceKey } from "@/lib/price";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

// 進入詳細頁再返回時,排行榜會重新掛載 → 用模組層級記憶保留使用者的篩選 / 排序 /
// 測試包與面板開合狀態,避免回來後全部被清空(SPA 內導覽不會重整,模組狀態長存)。
interface LbMemory {
  pack: PackKey | null;
  search: string;
  selected: Selected;
  sort: SortKey;
  priceRanges: Ranges;
  sizeRanges: Ranges;
  showFilters: boolean;
}
let lbMemory: LbMemory | null = null;

export default function Leaderboard() {
  const { t } = useI18n();
  const { db, loading, error } = useDb();
  const [pack, setPack] = useState<PackKey | null>(() => lbMemory?.pack ?? null);
  const [search, setSearch] = useState(() => lbMemory?.search ?? "");
  const [selected, setSelected] = useState<Selected>(() => lbMemory?.selected ?? emptySelected());
  const [sort, setSort] = useState<SortKey>(() => lbMemory?.sort ?? "score");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(() => lbMemory?.showFilters ?? false);
  const [showRankHelp, setShowRankHelp] = useState(false);

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
  const [priceRanges, setPriceRanges] = useState<Ranges>(() => lbMemory?.priceRanges ?? {});
  const sizeBounds = useMemo(() => computeBounds(rows, SIZE_FIELDS), [rows]);
  const [sizeRanges, setSizeRanges] = useState<Ranges>(() => lbMemory?.sizeRanges ?? {});

  const facets = useMemo(() => computeFacets(rows, search, selected), [rows, search, selected]);
  const filtered = useMemo(
    () => applyFilters(rows, search, selected, sort, priceRanges, priceBounds, sizeRanges, sizeBounds),
    [rows, search, selected, sort, priceRanges, priceBounds, sizeRanges, sizeBounds]
  );
  // 並列名次:只有「分數 + 啟用量 + 參數量」三者都相同才並列(競賽式名次,如 1,2,2,4…);
  // 啟用量 / 參數量越小越好。seq 為實際順序(1,2,3,4…)。非「分數」排序則用顯示順序當名次。
  const ranks = useMemo(() => {
    if (sort !== "score") return filtered.map((_, i) => i + 1);
    const size = (s: string | null) => parseSize(s) ?? Infinity; // 無資料視為最大(最差)
    const isBetter = (a: SubmissionRow, b: SubmissionRow): boolean => {
      if (a.scoreTotal !== b.scoreTotal) return a.scoreTotal > b.scoreTotal; // 分數高者佳
      const aa = size(a.sizeActive);
      const ba = size(b.sizeActive);
      if (aa !== ba) return aa < ba; // 啟用量小者佳
      return size(a.sizeParams) < size(b.sizeParams); // 參數量小者佳
    };
    // 名次 = 嚴格優於自己的筆數 + 1;三者全等者並列同名次。
    return filtered.map((row) => 1 + filtered.filter((o) => isBetter(o, row)).length);
  }, [filtered, sort]);

  useEffect(() => {
    if (!pack && packs.length > 0) setPack({ name: packs[0].name, ver: packs[0].ver });
  }, [packs, pack]);

  // 把目前狀態寫回記憶,供返回時還原(空區間 = 完整範圍,故不需預填 bounds)。
  useEffect(() => {
    lbMemory = { pack, search, selected, sort, priceRanges, sizeRanges, showFilters };
  }, [pack, search, selected, sort, priceRanges, sizeRanges, showFilters]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [pack, search, selected, sort, priceRanges, sizeRanges]);

  // 切換測試包時保留所有篩選條件,方便用同一組條件橫向對比不同測試的結果。
  const changePack = (next: PackKey) => {
    setPack(next);
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
        if (prev.deployment?.has("cloud")) return prev;
        const next: Selected = { ...prev };
        next.deployment = new Set(next.deployment ?? []).add("cloud");
        return next;
      });
    }
  };

  // 重置篩選器:清空面向 / 區間 / 搜尋,並還原排序(保留目前測試包)。
  const resetAll = () => {
    setSelected(emptySelected());
    setPriceRanges({});
    setSizeRanges({});
    setSearch("");
    setSort("score");
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
            {t("lb.badge")}
          </span>
          <h1 className="hero-title font-display font-extrabold tracking-tight">
            {t("lb.title.pre")}{" "}
            <span className="from-primary bg-gradient-to-r to-cyan-300 bg-clip-text text-transparent">
              {t("lb.title.accent")}
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
          {t("loading")}
        </div>
      ) : error ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mx-auto max-w-md rounded-xl border p-6 text-center text-sm">
          <p className="font-medium">{t("lb.error.title")}</p>
          <p className="mt-1 opacity-80">{error}</p>
          <p className="text-muted-foreground mt-3 text-xs">{t("lb.error.hint")}</p>
        </div>
      ) : !db || packs.length === 0 ? (
        <div className="text-muted-foreground mx-auto max-w-md rounded-xl border p-10 text-center text-sm">
          {t("lb.empty")}
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
                {t("filter.title")}{activeFilters > 0 ? ` · ${activeFilters}` : ""}
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
              <span className="inline-flex items-center gap-1.5">
                {search.trim() || activeFilters > 0
                  ? t("lb.count.matched", { n: filtered.length })
                  : t("lb.count.all", { n: filtered.length })}
                <button
                  type="button"
                  onClick={() => setShowRankHelp((v) => !v)}
                  aria-label={t("lb.rank.help.title")}
                  aria-expanded={showRankHelp}
                  className={cn(
                    "hover:text-foreground inline-flex items-center transition-colors",
                    showRankHelp && "text-foreground"
                  )}
                >
                  <Info className="size-3.5" />
                </button>
              </span>
              <span>{t("lb.count.total", { n: rows.length })}</span>
            </div>

            {showRankHelp ? (
              <div className="border-border/60 bg-card/50 text-muted-foreground rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed">
                <p className="text-foreground mb-1 font-semibold">{t("lb.rank.help.title")}</p>
                {t("lb.rank.help.body")}
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <div className="text-muted-foreground border-border/60 rounded-2xl border border-dashed py-16 text-center text-sm">
                {t("lb.noMatch")}
              </div>
            ) : (
              <>
                {filtered.slice(0, visible).map((row, index) => (
                  <SubmissionCard key={row.id} row={row} rank={ranks[index]} seq={index + 1} index={index} />
                ))}
                {filtered.length > visible ? (
                  <Button
                    variant="outline"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="mt-2 self-center rounded-full"
                  >
                    {t("lb.showMore", { n: filtered.length - visible })}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
