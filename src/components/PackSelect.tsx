import { Layers } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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

/** BenchPack 下拉選單,分類顯示為 {name} · v{ver}。 */
export function PackSelect({ packs, value, onChange }: PackSelectProps) {
  return (
    <Select
      value={value ? packId(value) : undefined}
      onValueChange={(v) => {
        const [name, ver] = v.split("@@");
        onChange({ name, ver });
      }}
    >
      <SelectTrigger aria-label="選擇測試類型" className="min-w-56">
        <Layers className="text-primary size-4 shrink-0" />
        <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">測試</span>
        <SelectValue
          placeholder="選擇測試"
          className="font-display text-sm font-bold tracking-tight"
        />
      </SelectTrigger>
      <SelectContent>
        {packs.map((p) => (
          <SelectItem key={packId(p)} value={packId(p)} className="font-display font-semibold">
            {p.name} · v{p.ver}
            <span className="text-muted-foreground ml-1 font-sans font-normal">（{p.count}）</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
