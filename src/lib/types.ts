export interface PackInfo {
  name: string;
  ver: string;
  count: number;
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
  modelName: string;
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
  hwDevice: string | null;
  hwChip: string | null;
  hwOs: string | null;
  hwDriver: string | null;
  hwExtra: Record<string, string | number | boolean>;
  scoreTotal: number;
  scoreCats: ScoreCategory[];
  passCount: number;
  totalCount: number;
  totalTime: number;
  runDate: string;
  runMode: string | null;
  runsPerTest: number;
}
