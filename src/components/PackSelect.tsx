import { ChevronDown, Layers } from "lucide-react";

import type { PackInfo } from "@/lib/types";

export interface PackKey {
  name: string;
  ver: string;
}

export function packId(p: PackKey): string {
  return `${p.name}@@${p.ver}`;
}

interface PackSelectProps {
  packs: PackInfo[];
  value: PackKey | null;
  onChange: (pack: PackKey) => void;
}

/** BenchPack 下拉選單,分類顯示為 {name}-{ver}。 */
export function PackSelect({ packs, value, onChange }: PackSelectProps) {
  return (
    <label className="group bg-card/70 border-border/70 hover:border-primary/50 relative flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 backdrop-blur-xl transition-colors">
      <Layers className="text-primary size-4 shrink-0" />
      <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">測試</span>
      <select
        aria-label="選擇測試類型"
        value={value ? packId(value) : ""}
        onChange={(e) => {
          const [name, ver] = e.target.value.split("@@");
          onChange({ name, ver });
        }}
        className="font-display cursor-pointer appearance-none bg-transparent pr-5 text-sm font-bold tracking-tight outline-none"
      >
        {packs.map((p) => (
          <option key={packId(p)} value={packId(p)} className="bg-card font-sans font-normal">
            {p.name} · v{p.ver}（{p.count}）
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute right-3 size-4" />
    </label>
  );
}
