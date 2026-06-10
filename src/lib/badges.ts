import { Boxes, Cloud, Cpu, Lock, LockOpen, Network, type LucideIcon } from "lucide-react";

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

// 參數量:如「35B」。無資料回 null。
export function paramsBadge(sizeParams: string | null): BadgeInfo | null {
  if (!sizeParams) return null;
  return { label: sizeParams, className: "text-fuchsia-300", Icon: Boxes };
}

// 架構:如「MoE • 3B」(啟用量與總參數不同時才附上)、Dense 則只顯示「Dense」。無架構回 null。
export function archBadge(
  modelType: string | null,
  sizeActive: string | null,
  sizeParams: string | null
): BadgeInfo | null {
  if (!modelType) return null;
  const showActive = sizeActive && sizeActive !== sizeParams;
  return {
    label: showActive ? `${modelType} • ${sizeActive}` : modelType,
    className: "text-teal-300",
    Icon: Network
  };
}
