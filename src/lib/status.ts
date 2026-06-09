/**
 * 單題狀態語意(前端與 build-db 共用,避免兩邊判斷分歧)。
 * 依 schema:1=正常、0=錯誤、null=半對、-1=未執行;另相容 (0,1) 小數視為半對。
 */
export type StatusKind = "pass" | "half" | "fail" | "skip";

export function statusKind(status: number | null): StatusKind {
  if (status === null) return "half"; // 半對
  if (status > 0 && status < 1) return "half"; // 相容舊資料的小數
  if (status < 0) return "skip"; // 未執行,不計入
  if (status >= 1) return "pass"; // 正常
  return "fail"; // 0 錯誤
}

/** 半對給 0.5 分,正常 1 分,其餘 0 分。 */
export function passCredit(kind: StatusKind): number {
  return kind === "pass" ? 1 : kind === "half" ? 0.5 : 0;
}

/** 通過數顯示:半對算 0.5,整數不帶小數,否則保留一位。 */
export function formatPass(passCount: number, halfCount: number): string {
  const v = passCount + halfCount * 0.5;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
