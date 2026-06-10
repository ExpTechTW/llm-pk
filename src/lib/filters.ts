import type { SubmissionRow } from "./types";

// 速度排行沒有意義(不同 device 無法比較),故只提供分數 / 最新。
export type SortKey = "score" | "recent";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "分數" },
  { key: "recent", label: "最新" }
];

export interface FacetDef {
  key: string;
  label: string;
  get: (r: SubmissionRow) => string | null;
}

// 篩選面向。值即顯示文字,篩選與計數都用同一個 getter。
export const FACETS: FacetDef[] = [
  { key: "deployment", label: "部署", get: (r) => (r.deployment === "cloud" ? "雲端" : "本地") },
  { key: "access", label: "權重", get: (r) => (r.access === "closed" ? "閉源" : "開源") },
  {
    key: "thinking",
    label: "思考模式",
    get: (r) => (r.thinking === null ? null : r.thinking ? "思考" : "非思考")
  },
  { key: "family", label: "系列", get: (r) => r.familyName },
  { key: "type", label: "架構", get: (r) => r.modelType },
  { key: "quantFormat", label: "量化格式", get: (r) => r.quantFormat },
  { key: "quantLevel", label: "量化等級", get: (r) => r.quantLevel },
];

// 把參數量字串(如 "30B"、"2.5B"、"550M"、"1.6T")換算成數值(以 B 為單位)。
export function parseSize(value: string | null): number | null {
  if (!value) return null;
  const m = value.trim().match(/^([\d.]+)\s*([KMBT]?)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const mult: Record<string, number> = { K: 1e-6, M: 1e-3, B: 1, T: 1e3, "": 1 };
  return n * (mult[m[2].toUpperCase()] ?? 1);
}

// 數值區間篩選(用拉桿)。價格與參數量/啟用量共用同一套機制。
export type Range = [number, number];
export type Ranges = Record<string, Range>;
export type Bounds = Record<string, Range>;

// 向後相容的別名(原本只有價格用)。
export type PriceRange = Range;
export type PriceRanges = Ranges;
export type PriceBounds = Bounds;

export interface RangeFieldDef {
  key: string;
  label: string;
  get: (r: SubmissionRow) => number | null;
  format: (v: number) => string; // 拉桿端點顯示格式
  step: (min: number, max: number) => number; // 拉桿步進
}

function fmtPrice(v: number): string {
  return `$${Number.isInteger(v) ? v : Number(v.toFixed(2))}`;
}

function priceStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 2) return 0.01;
  if (span <= 20) return 0.1;
  return 1;
}

function fmtSize(v: number): string {
  if (v >= 1000) return `${Number((v / 1000).toFixed(2))}T`;
  if (v < 1) return `${Number((v * 1000).toFixed(0))}M`;
  return `${Number.isInteger(v) ? v : Number(v.toFixed(1))}B`;
}

function sizeStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 5) return 0.1;
  if (span <= 50) return 1;
  return 5;
}

// 價格區間(單位 USD / 1M tokens)。
export const PRICE_FIELDS: RangeFieldDef[] = [
  { key: "priceIn", label: "輸入", get: (r) => r.priceInput, format: fmtPrice, step: priceStep },
  { key: "priceCache", label: "快取輸入", get: (r) => r.priceCacheInput, format: fmtPrice, step: priceStep },
  { key: "priceOut", label: "輸出", get: (r) => r.priceOutput, format: fmtPrice, step: priceStep }
];

// 規模區間(以 B 為單位換算自字串)。
export const SIZE_FIELDS: RangeFieldDef[] = [
  { key: "sizeParams", label: "參數量", get: (r) => parseSize(r.sizeParams), format: fmtSize, step: sizeStep },
  { key: "sizeActive", label: "啟用量", get: (r) => parseSize(r.sizeActive), format: fmtSize, step: sizeStep }
];

/** 每個欄位在整份資料的 [最低, 最高];無資料或無區間(min==max)的欄位略過。 */
export function computeBounds(rows: SubmissionRow[], fields: RangeFieldDef[]): Bounds {
  const out: Bounds = {};
  for (const f of fields) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      const v = f.get(r);
      if (v === null || Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min !== Infinity && max > min) out[f.key] = [min, max];
  }
  return out;
}

/** @deprecated 用 computeBounds(rows, PRICE_FIELDS) */
export function computePriceBounds(rows: SubmissionRow[]): Bounds {
  return computeBounds(rows, PRICE_FIELDS);
}

function rangeActive(range: Range | undefined, bound: Range | undefined): boolean {
  if (!range || !bound) return false;
  return range[0] > bound[0] || range[1] < bound[1];
}

/** 已調整(縮小)的區間數量。 */
export function countRangeActive(ranges: Ranges, bounds: Bounds, fields: RangeFieldDef[]): number {
  return fields.reduce((n, f) => n + (rangeActive(ranges[f.key], bounds[f.key]) ? 1 : 0), 0);
}

/** @deprecated 用 countRangeActive(ranges, bounds, PRICE_FIELDS) */
export function countPriceActive(ranges: Ranges, bounds: Bounds): number {
  return countRangeActive(ranges, bounds, PRICE_FIELDS);
}

function matchesRanges(
  r: SubmissionRow,
  ranges: Ranges,
  bounds: Bounds,
  fields: RangeFieldDef[]
): boolean {
  for (const f of fields) {
    if (!rangeActive(ranges[f.key], bounds[f.key])) continue;
    const v = f.get(r);
    if (v === null || Number.isNaN(v)) continue; // 無資料者不受該區間篩選影響
    const [lo, hi] = ranges[f.key];
    if (v < lo || v > hi) return false;
  }
  return true;
}

export type Selected = Record<string, Set<string>>;

export function emptySelected(): Selected {
  return Object.fromEntries(FACETS.map((f) => [f.key, new Set<string>()]));
}

export function countSelected(selected: Selected): number {
  return Object.values(selected).reduce((n, set) => n + set.size, 0);
}

function matchesSearch(r: SubmissionRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [r.modelName, r.familyName, r.uploader, r.backendName]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
}

// 是否通過某幾個面向的篩選(可排除某個面向,用於計算該面向的可選計數)。
function matchesFacets(r: SubmissionRow, selected: Selected, exceptKey?: string): boolean {
  for (const facet of FACETS) {
    if (facet.key === exceptKey) continue;
    const chosen = selected[facet.key];
    if (!chosen || chosen.size === 0) continue;
    const value = facet.get(r);
    if (value === null || !chosen.has(value)) return false;
  }
  return true;
}

// 同分時的排名優先度(由高到低):開源 > 閉源、小參數 > 大參數、本地 > 雲端,最後才看平均速度。
function tiebreak(a: SubmissionRow, b: SubmissionRow): number {
  // 1) 開源 > 閉源
  const openA = a.access === "closed" ? 1 : 0;
  const openB = b.access === "closed" ? 1 : 0;
  if (openA !== openB) return openA - openB;
  // 2) 小參數 > 大參數(無參數資料視為最大,排後面)
  const paramA = parseSize(a.sizeParams) ?? Infinity;
  const paramB = parseSize(b.sizeParams) ?? Infinity;
  if (paramA !== paramB) return paramA - paramB;
  // 3) 本地 > 雲端
  const localA = a.deployment === "cloud" ? 1 : 0;
  const localB = b.deployment === "cloud" ? 1 : 0;
  if (localA !== localB) return localA - localB;
  // 最後的決勝:平均每題速度(快者在前)
  return avgTime(a) - avgTime(b);
}

function sortRows(rows: SubmissionRow[], sort: SortKey): SubmissionRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "score") return b.scoreTotal - a.scoreTotal || tiebreak(a, b);
    return b.runDate.localeCompare(a.runDate) || b.scoreTotal - a.scoreTotal || tiebreak(a, b);
  });
  return copy;
}

export function avgTime(r: SubmissionRow): number {
  return r.totalCount > 0 ? r.totalTime / r.totalCount : Number.POSITIVE_INFINITY;
}

export function applyFilters(
  rows: SubmissionRow[],
  search: string,
  selected: Selected,
  sort: SortKey,
  priceRanges: Ranges = {},
  priceBounds: Bounds = {},
  sizeRanges: Ranges = {},
  sizeBounds: Bounds = {}
): SubmissionRow[] {
  const q = search.trim();
  const filtered = rows.filter(
    (r) =>
      matchesSearch(r, q) &&
      matchesFacets(r, selected) &&
      matchesRanges(r, priceRanges, priceBounds, PRICE_FIELDS) &&
      matchesRanges(r, sizeRanges, sizeBounds, SIZE_FIELDS)
  );
  return sortRows(filtered, sort);
}

export interface FacetValueCount {
  value: string;
  count: number;
}

// 每個面向的可選值 + 數量(計數時套用搜尋與「其他」面向的篩選,標準 faceted search 行為)。
export function computeFacets(
  rows: SubmissionRow[],
  search: string,
  selected: Selected
): Record<string, FacetValueCount[]> {
  const q = search.trim();
  const out: Record<string, FacetValueCount[]> = {};
  for (const facet of FACETS) {
    // 先收集此面向在整份資料的所有值(universe),確保選項/分類不會因為其他篩選而消失
    const universe = new Set<string>();
    for (const r of rows) {
      const value = facet.get(r);
      if (value !== null && value !== "") universe.add(value);
    }

    // 套用搜尋與「其他」面向篩選後的數量(可能為 0)
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!matchesSearch(r, q)) continue;
      if (!matchesFacets(r, selected, facet.key)) continue;
      const value = facet.get(r);
      if (value === null || value === "") continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    out[facet.key] = [...universe]
      .map((value) => ({ value, count: counts.get(value) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  return out;
}
