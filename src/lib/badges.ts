import { Boxes, Cloud, Cpu, Lock, LockOpen, Network, type LucideIcon } from "lucide-react";

import type { SubmissionRow } from "./types";

export interface BadgeInfo {
  label: string;
  className: string; // 文字 + icon 顏色
  Icon: LucideIcon; // outline 圖示
}

// 量化標籤特例配色:命中關鍵字者套用指定色,其餘用預設(格式=紫、等級=青)。
const QUANT_COLOR_RULES: { match: string[]; className: string }[] = [
  { match: ["BF16", "Q8"], className: "text-orange-300" },
  { match: ["GGUF", "SAFETENSORS"], className: "text-blue-300" }
];

export function quantColor(value: string, fallback: string): string {
  const up = value.toUpperCase();
  const rule = QUANT_COLOR_RULES.find((r) => r.match.some((m) => up.includes(m)));
  return rule ? rule.className : fallback;
}

// 部署:雲端(藍)/ 本地(橘)
export function deployBadge(deployment: SubmissionRow["deployment"]): BadgeInfo {
  return deployment === "cloud"
    ? { label: "雲端", className: "text-sky-300", Icon: Cloud }
    : { label: "本地", className: "text-orange-300", Icon: Cpu };
}

// 權重:開源(綠)/ 閉源(紅)
export function accessBadge(access: SubmissionRow["access"]): BadgeInfo {
  return access === "closed"
    ? { label: "閉源", className: "text-red-300", Icon: Lock }
    : { label: "開源", className: "text-emerald-300", Icon: LockOpen };
}

// 參數量:如「35B」。無資料回 null。
export function paramsBadge(sizeParams: string | null): BadgeInfo | null {
  if (!sizeParams) return null;
  return { label: sizeParams, className: "text-fuchsia-300", Icon: Boxes };
}

// 架構:MoE 附啟用參數「MoE • 3B」(啟用量與總參數不同時),否則只顯示架構。無架構回 null。
export function archBadge(
  modelType: string | null,
  sizeActive: string | null,
  sizeParams: string | null
): BadgeInfo | null {
  if (!modelType) return null;
  const label = sizeActive && sizeActive !== sizeParams ? `${modelType} • ${sizeActive}` : modelType;
  return { label, className: "text-teal-300", Icon: Network };
}

type BadgeSource = Pick<
  SubmissionRow,
  "access" | "deployment" | "sizeActive" | "sizeParams" | "modelType"
>;

// 統一的徽章順序:權重 → 參數量 → 架構(含啟用)→ 部署。空的(無資料)自動略過。
export function modelBadges(row: BadgeSource): BadgeInfo[] {
  return [
    accessBadge(row.access),
    paramsBadge(row.sizeParams),
    archBadge(row.modelType, row.sizeActive, row.sizeParams),
    deployBadge(row.deployment)
  ].filter((b): b is BadgeInfo => b !== null);
}
