import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { OrgLogo } from "@/components/ui/org-logo";
import type { SubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

// 捲動速度(像素/秒)。以 px/s 計算,三排寬度不同也維持完全一致的速度。
const SPEED = 55;
// 每排最少 pill 數,不足時重複填滿,確保無縫補回、不留空白
const MIN_PILLS = 14;

function Pill({ row }: { row: SubmissionRow }) {
  return (
    <Link
      to={`/s/${row.id}`}
      className="border-border/60 bg-card/60 hover:border-primary/50 hover:bg-card flex shrink-0 items-center gap-2.5 rounded-full border px-3 py-2 backdrop-blur-sm transition-colors"
    >
      <OrgLogo org={row.modelOrg} avatar={row.orgAvatar} size={26} radius="rounded-lg" />
      <span className="max-w-[200px] truncate text-sm font-semibold">{row.modelName}</span>
      <span className="font-data text-primary text-sm font-bold tabular-nums">
        {row.scoreTotal.toFixed(1)}
      </span>
    </Link>
  );
}

function Row({ items, reverse }: { items: SubmissionRow[]; reverse?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);

  // 量測單份內容寬度(track 含兩份 → 取一半),依固定 px/s 推算 duration → 各排速度一致
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const period = el.scrollWidth / 2;
      if (period > 0) setDuration(period / SPEED);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  if (items.length === 0) return null;
  // 複製一份內容,搭配 translateX(-50%) 達成無縫循環
  const loop = [...items, ...items];
  return (
    <div className="group flex overflow-hidden">
      <div
        ref={trackRef}
        className={cn(
          "flex w-max shrink-0 gap-3 pr-3 group-hover:paused",
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        )}
        style={duration ? { animationDuration: `${duration}s` } : { animationPlayState: "paused" }}
      >
        {loop.map((row, i) => (
          <Pill key={`${row.id}-${i}`} row={row} />
        ))}
      </div>
    </div>
  );
}

function rotate(list: SubmissionRow[], n: number): SubmissionRow[] {
  const k = ((n % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

function fill(list: SubmissionRow[]): SubmissionRow[] {
  if (list.length === 0) return list;
  let out = list;
  while (out.length < MIN_PILLS) out = [...out, ...list];
  return out;
}

/** 模型跑馬燈:三排(左 / 右 / 左)等速交錯捲動,皆有無縫資料補回。 */
export function ModelMarquee({ rows }: { rows: SubmissionRow[] }) {
  if (rows.length === 0) return null;

  // 三排都用完整清單(寬度一致 → 速度一致),僅以起點偏移與方向區隔
  const lane0 = fill(rotate(rows, 0));
  const lane1 = fill(rotate(rows, Math.floor(rows.length / 3)));
  const lane2 = fill(rotate(rows, Math.floor((rows.length * 2) / 3)));

  return (
    <div className="relative flex flex-col gap-3 mask-[linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <Row items={lane0} />
      <Row items={lane1} reverse />
      <Row items={lane2} />
    </div>
  );
}
