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

/** 載入某個 pack+ver 的題庫(快取;檔案不存在時回 null)。 */
export function loadExam(pack: string, ver: string): Promise<ExamPack | null> {
  const key = `${pack}/${ver}`;
  if (!cache.has(key)) {
    const url = `${import.meta.env.BASE_URL}exam/${encodeURIComponent(pack)}/${encodeURIComponent(ver)}.json`;
    cache.set(
      key,
      fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<ExamPack>) : null))
        .catch(() => null)
    );
  }
  return cache.get(key)!;
}
