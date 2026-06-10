import { Boxes, Cloud, Cpu, Lock, LockOpen, Network, Zap, type LucideIcon } from "lucide-react";

import type { SubmissionRow } from "./types";

export interface BadgeInfo {
  label: string;
  className: string; // 文字 + icon 顏色
  Icon: LucideIcon; // outline 圖示
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

// 啟用參數:如「3B」。僅 MoE(啟用量與總參數不同)時顯示,Dense / 無資料回 null。
export function activeBadge(sizeActive: string | null, sizeParams: string | null): BadgeInfo | null {
  if (!sizeActive || sizeActive === sizeParams) return null;
  return { label: sizeActive, className: "text-amber-300", Icon: Zap };
}

// 參數量:如「35B」。無資料回 null。
export function paramsBadge(sizeParams: string | null): BadgeInfo | null {
  if (!sizeParams) return null;
  return { label: sizeParams, className: "text-fuchsia-300", Icon: Boxes };
}

// 架構:如「MoE」/「Dense」。無架構回 null。
export function archBadge(modelType: string | null): BadgeInfo | null {
  if (!modelType) return null;
  return { label: modelType, className: "text-teal-300", Icon: Network };
}

type BadgeSource = Pick<
  SubmissionRow,
  "access" | "deployment" | "sizeActive" | "sizeParams" | "modelType"
>;

// 統一的徽章順序:權重 → 啟用參數 → 參數量 → 架構 → 部署。空的(無資料)自動略過。
export function modelBadges(row: BadgeSource): BadgeInfo[] {
  return [
    accessBadge(row.access),
    activeBadge(row.sizeActive, row.sizeParams),
    paramsBadge(row.sizeParams),
    archBadge(row.modelType),
    deployBadge(row.deployment)
  ].filter((b): b is BadgeInfo => b !== null);
}
