// 題目 + 評分標準:由 public/exam/{pack}/{ver}.json 取得(BenchLocal 匯出)。
export interface ExamQuestion {
  title?: string;
  prompt: string; // 題目內容
  criteria?: string[]; // 評分標準
  category?: string;
  tags?: string[];
}

export interface ExamPack {
  pack: string;
  ver: string;
  scenarios: Record<string, ExamQuestion>;
}

const cache = new Map<string, Promise<ExamPack | null>>();

function examUrl(pack: string, ver: string, suffix: string): string {
  return `${import.meta.env.BASE_URL}exam/${encodeURIComponent(pack)}/${encodeURIComponent(ver)}${suffix}.json`;
}

/**
 * 載入某個 pack+ver 的題庫。優先指定語言 {ver}.{lang}.json,退回英文 {ver}.en.json,
 * 最後退回無語言後綴的 {ver}.json(向後相容);皆無則回 null。結果有快取。
 */
export function loadExam(pack: string, ver: string, lang: string = "en"): Promise<ExamPack | null> {
  const key = `${pack}/${ver}/${lang}`;
  if (!cache.has(key)) {
    const fetchJson = (suffix: string) =>
      fetch(examUrl(pack, ver, suffix)).then((r) => (r.ok ? (r.json() as Promise<ExamPack>) : null));
    // 依序嘗試的後綴(去重):.{lang} → .en → 空(base)
    const suffixes = [...new Set([`.${lang}`, ".en", ""])];
    const tryNext = (i: number): Promise<ExamPack | null> =>
      i >= suffixes.length
        ? Promise.resolve(null)
        : fetchJson(suffixes[i]).then((e) => e ?? tryNext(i + 1));
    cache.set(key, tryNext(0).catch(() => null));
  }
  return cache.get(key)!;
}
