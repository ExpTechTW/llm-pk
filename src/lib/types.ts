export interface PackInfo {
  name: string;
  ver: string;
  count: number;
}

export interface ResultEntry {
  scenarioId: string;
  status: number | null; // 1=正常、0=錯誤、null=半對、-1=未執行
  time: number;
}

export interface ScoreCategory {
  id: string;
  label?: string;
  score: number;
  weight?: number;
}

export interface SubmissionRow {
  id: number;
  author: string;
  benchlocal: string;
  packName: string;
  packVer: string;
  modelName: string;
  modelId: string | null;
  modelOrg: string | null;
  orgAvatar: string | null;
  modelLink: string | null;
  access: "open" | "closed" | string;
  deployment: "local" | "cloud" | string;
  familyName: string | null;
  familyVer: string | null;
  modelType: string | null;
  sizeParams: string | null;
  sizeActive: string | null;
  quantFormat: string | null;
  quantLevel: string | null;
  quantMethod: string | null;
  backendName: string;
  backendVer: string | null;
  hwCompany: string | null;
  hwAvatar: string | null;
  hwDevice: string | null;
  hwChip: string | null;
  hwOs: string | null;
  hwDriver: string | null;
  hwExtra: Record<string, string | number | boolean>;
  scoreTotal: number;
  scoreCats: ScoreCategory[];
  passCount: number;
  halfCount: number;
  totalCount: number;
  totalTime: number;
  runDate: string;
  runMode: string | null;
  runsPerTest: number;
  // 價格(USD / 1M tokens),由 price.csv 比對後在前端補上;無資料為 null
  priceInput: number | null;
  priceCacheInput: number | null;
  priceOutput: number | null;
}
