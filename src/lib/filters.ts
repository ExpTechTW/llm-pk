import type { SubmissionRow } from "./types";

// 速度排行沒有意義(不同 device 無法比較),故只提供分數 / 最新 / 啟動參數量。
export type SortKey = "score" | "recent" | "activeAsc" | "activeDesc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "分數" },
  { key: "recent", label: "最新" },
  { key: "activeAsc", label: "啟動參數 少→多" },
  { key: "activeDesc", label: "啟動參數 多→少" }
];

// 將參數量字串(如 "2.5B"、"350M"、"1.2T")轉成可比較的數值;無法解析回傳 null。
export function parseParamCount(s: string | null): number | null {
  if (!s) return null;
  const m = s.trim().match(/^([\d.]+)\s*([kmbt])?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const mult =
    unit === "t" ? 1e12 : unit === "b" ? 1e9 : unit === "m" ? 1e6 : unit === "k" ? 1e3 : 1;
  return n * mult;
}

export interface FacetDef {
  key: string;
  label: string;
  get: (r: SubmissionRow) => string | null;
}

// 篩選面向。值即顯示文字,篩選與計數都用同一個 getter。
export const FACETS: FacetDef[] = [
  { key: "deployment", label: "部署", get: (r) => (r.deployment === "cloud" ? "雲端" : "開源") },
  { key: "access", label: "權重", get: (r) => (r.access === "closed" ? "閉源" : "開源") },
  { key: "family", label: "系列", get: (r) => r.familyName },
  { key: "type", label: "架構", get: (r) => r.modelType },
  { key: "quantFormat", label: "量化格式", get: (r) => r.quantFormat },
  { key: "quantLevel", label: "量化等級", get: (r) => r.quantLevel },
];

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
  return [r.modelName, r.familyName, r.author, r.backendName]
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

function sortRows(rows: SubmissionRow[], sort: SortKey): SubmissionRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "activeAsc" || sort === "activeDesc") {
      const av = parseParamCount(a.sizeActive);
      const bv = parseParamCount(b.sizeActive);
      // 無啟動參數資料者一律排在最後
      if (av === null && bv === null) return b.scoreTotal - a.scoreTotal;
      if (av === null) return 1;
      if (bv === null) return -1;
      const diff = sort === "activeAsc" ? av - bv : bv - av;
      return diff || b.scoreTotal - a.scoreTotal;
    }
    if (sort === "score") return b.scoreTotal - a.scoreTotal || avgTime(a) - avgTime(b);
    return b.runDate.localeCompare(a.runDate) || b.scoreTotal - a.scoreTotal;
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
  sort: SortKey
): SubmissionRow[] {
  const q = search.trim();
  const filtered = rows.filter((r) => matchesSearch(r, q) && matchesFacets(r, selected));
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
