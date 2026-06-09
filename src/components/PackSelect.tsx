import { ChevronDown, Package } from "lucide-react";

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
    <div className="relative inline-flex items-center">
      <Package className="text-muted-foreground pointer-events-none absolute left-3 size-4" />
      <select
        aria-label="選擇測試類型"
        value={value ? packId(value) : ""}
        onChange={(e) => {
          const [name, ver] = e.target.value.split("@@");
          onChange({ name, ver });
        }}
        className="border-input bg-card hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 h-10 cursor-pointer appearance-none rounded-lg border py-2 pr-9 pl-9 text-sm font-medium shadow-xs transition-colors outline-none focus-visible:ring-[3px]"
      >
        {packs.map((p) => (
          <option key={packId(p)} value={packId(p)}>
            {p.name}-{p.ver}（{p.count}）
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute right-3 size-4" />
    </div>
  );
}
