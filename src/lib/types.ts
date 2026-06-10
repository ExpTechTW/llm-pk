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
  file: string; // 穩定唯一鍵(檔名去目錄/副檔名),重建 DB 不變,供分享連結用
  uploader: string; // results_upload:上傳跑分結果者的 GitHub 帳號
  benchlocal: string;
  packName: string;
  packVer: string;
  modelName: string;
  modelId: string | null;
  modelOrg: string | null;
  orgAvatar: string | null;
  modelLink: string | null;
  linkAuthor: string | null; // 模型作者(HuggingFace 帳號,取自 link)
  linkAuthorAvatar: string | null; // 模型作者的 HF 頭像 URL
  access: "open" | "closed" | string;
  deployment: "local" | "cloud" | string;
  familyName: string | null;
  familyVer: string | null;
  modelType: string | null;
  thinking: boolean | null;
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
