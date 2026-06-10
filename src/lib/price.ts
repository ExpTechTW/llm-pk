/** 模型價格(讀自 public/price.csv,單位:USD / 1M tokens)。 */
export interface PriceInfo {
  input: number;
  cacheInput: number | null; // 該模型無 prompt caching → 留空(null),不參與快取價篩選
  output: number;
}

export type PriceMap = Map<string, PriceInfo>;

let pricePromise: Promise<PriceMap> | null = null;

/** 正規化比對鍵(忽略大小寫與前後空白)。 */
export function priceKey(name: string): string {
  return name.trim().toLowerCase();
}

function parseCsv(text: string): PriceMap {
  const map: PriceMap = new Map();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return map;
  // 第一列為標題
  for (const line of lines.slice(1)) {
    const [name, input, cacheInput, output] = line.split(",");
    if (!name) continue;
    const cache = cacheInput?.trim();
    map.set(priceKey(name), {
      input: Number(input) || 0,
      cacheInput: cache ? Number(cache) || 0 : null, // 空白 → null(無快取價)
      output: Number(output) || 0
    });
  }
  return map;
}

/** 載入並快取 price.csv;失敗時回傳空 Map(不影響其餘功能)。 */
export function loadPrices(): Promise<PriceMap> {
  if (!pricePromise) {
    pricePromise = (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}price.csv`, { cache: "no-cache" });
        if (!res.ok) return new Map();
        return parseCsv(await res.text());
      } catch {
        return new Map();
      }
    })();
  }
  return pricePromise;
}

/** 依 output 價格(USD / 1M tokens)分級;無價格資料回傳 null。 */
export function priceTier(output: number | null): string | null {
  if (output === null || output === undefined || Number.isNaN(output)) return null;
  if (output <= 0) return "免費";
  if (output <= 1) return "$ 經濟";
  if (output <= 10) return "$$ 標準";
  return "$$$ 高階";
}
