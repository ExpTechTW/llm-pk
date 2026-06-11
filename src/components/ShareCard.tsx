import { forwardRef } from "react";
import { Binary, Boxes, Cloud, Cpu, Lock, LockOpen, Network, type LucideIcon } from "lucide-react";

import type { SubmissionRow } from "@/lib/types";
import type { TFn } from "@/lib/i18n";
import { clamp } from "@/lib/utils";

// 卡片自帶配色(明確 hex,避免 oklch / 主題變數在 canvas 端的相容問題)。
const C = {
  bg: "#13150e",
  surface: "#1c1f15",
  border: "#2f3424",
  primary: "#b9ee4a",
  text: "#f4f5ef",
  sub: "#99a08b"
};

// 對齊排行榜徽章的 Tailwind -300 配色(以 hex 重現)。
const HUE = {
  emerald: "#6ee7b7",
  red: "#fca5a5",
  fuchsia: "#f0abfc",
  teal: "#5eead4",
  orange: "#fdba74",
  sky: "#7dd3fc",
  blue: "#93c5fd",
  cyan: "#67e8f9",
  amber: "#fcd34d"
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "PingFang TC", "PingFang SC", "Hiragino Sans", "Noto Sans CJK", sans-serif';

const scoreHue = (n: number) => (n >= 80 ? C.primary : n >= 50 ? HUE.amber : HUE.red);

interface Chip {
  label: string;
  color: string;
  Icon: LucideIcon;
}

// 量化配色:與 badges.ts 同規則(GGUF/Safetensors 藍、BF16/Q8 橘,其餘青)。
function quantHue(value: string): string {
  const up = value.toUpperCase();
  if (up.includes("GGUF") || up.includes("SAFETENSORS")) return HUE.blue;
  if (up.includes("BF16") || up.includes("Q8")) return HUE.orange;
  return HUE.cyan;
}

// 徽章順序對齊排行榜:權重 → 參數/架構 → 量化 → 部署。
function chipData(row: SubmissionRow, t: TFn): Chip[] {
  const out: Chip[] = [];
  out.push(
    row.access === "closed"
      ? { label: t("badge.closed"), color: HUE.red, Icon: Lock }
      : { label: t("badge.open"), color: HUE.emerald, Icon: LockOpen }
  );
  if (row.modelType?.toUpperCase() === "MOE" && row.sizeActive)
    out.push({ label: `MoE · ${row.sizeActive}`, color: HUE.teal, Icon: Network });
  else if (row.sizeParams) out.push({ label: row.sizeParams, color: HUE.fuchsia, Icon: Boxes });
  const quant = [row.quantFormat, row.quantLevel].filter(Boolean).join(" ");
  if (quant) out.push({ label: quant, color: quantHue(quant), Icon: Binary });
  out.push(
    row.deployment === "cloud"
      ? { label: t("badge.cloud"), color: HUE.sky, Icon: Cloud }
      : { label: t("badge.local"), color: HUE.orange, Icon: Cpu }
  );
  return out;
}

/**
 * 分享用的成績小卡(離屏渲染 → html-to-image 擷取成 PNG)。
 * 固定寬度、自帶配色、字母圖示(不抓外部頭像),確保擷取穩定。
 */
export const ShareCard = forwardRef<
  HTMLDivElement,
  { row: SubmissionRow; t: TFn; catLabel: (s: string) => string; siteLabel: string; avatar?: string | null }
>(function ShareCard({ row, t, catLabel, siteLabel, avatar }, ref) {
  const monogram = (row.modelOrg || row.modelName).trim().charAt(0).toUpperCase() || "?";
  const cats = row.scoreCats.slice(0, 6);
  const sub = row.modelOrg || "";

  return (
    <div
      ref={ref}
      style={{
        width: 480,
        boxSizing: "border-box",
        padding: 26,
        background: `radial-gradient(130% 90% at 100% 0%, #20271550 0%, ${C.bg} 58%)`,
        backgroundColor: C.bg,
        color: C.text,
        fontFamily: FONT,
        border: `1px solid ${C.border}`,
        borderRadius: 24
      }}
    >
      {/* 頂列:品牌 + 測試包 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 18 }}>
          <span>LLM</span>
          <span style={{ color: C.primary }}>PK</span>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.sub,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: "4px 11px"
          }}
        >
          {row.packName} · {row.packVer}
        </div>
      </div>

      {/* 身分 + 分數 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 18 }}>
        {avatar ? (
          <img
            src={avatar}
            alt=""
            width={48}
            height={48}
            style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 13, objectFit: "cover", background: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 13,
              background: C.primary,
              color: "#16180f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800
            }}
          >
            {monogram}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1, paddingTop: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" }}>
            {row.modelName}
          </div>
          {sub ? <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{sub}</div> : null}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, paddingTop: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: C.primary, lineHeight: 1 }}>
              {row.scoreTotal.toFixed(1)}
            </span>
            <span style={{ fontSize: 14, color: C.sub, fontWeight: 600 }}>/100</span>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            {t("sort.score")}
          </div>
        </div>
      </div>

      {/* 類別分數:緊湊雙欄磚塊(取代佔空間的長條) */}
      {cats.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {cats.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "8px 11px"
              }}
            >
              <span style={{ fontSize: 12.5, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {catLabel(c.label ?? c.id)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: scoreHue(clamp(c.score, 0, 100)), fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {c.score}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* 標籤列(配色對齊排行榜) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {chipData(row, t).map((c, i) => {
          const Icon = c.Icon;
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: c.color,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "4px 9px"
              }}
            >
              <Icon size={13} strokeWidth={2} />
              {c.label}
            </span>
          );
        })}
      </div>

      {/* 頁尾 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${C.border}`,
          paddingTop: 14,
          fontSize: 12,
          color: C.sub
        }}
      >
        <span style={{ fontWeight: 700, color: C.text }}>
          {t("detail.q.passInfo", {
            pass: row.halfCount > 0 ? `${row.passCount}+${row.halfCount}` : `${row.passCount}`,
            total: row.totalCount
          })}
        </span>
        <span>{siteLabel}</span>
      </div>
    </div>
  );
});
