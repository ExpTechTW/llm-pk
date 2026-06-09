import { Check, SlidersHorizontal, X } from "lucide-react";

import {
  FACETS,
  SORT_OPTIONS,
  countSelected,
  type FacetValueCount,
  type Selected,
  type SortKey
} from "@/lib/filters";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  facets: Record<string, FacetValueCount[]>;
  selected: Selected;
  onToggle: (facetKey: string, value: string) => void;
  onReset: () => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}

export function FilterSidebar({
  facets,
  selected,
  onToggle,
  onReset,
  sort,
  onSortChange
}: FilterSidebarProps) {
  const activeCount = countSelected(selected);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="text-primary size-4" />
        <span className="font-display text-sm font-bold">篩選與排序</span>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-xs"
          >
            <X className="size-3" />
            清除 {activeCount}
          </button>
        ) : null}
      </div>

      {/* 排序 */}
      <section className="flex flex-col gap-2">
        <h4 className="text-muted-foreground text-[10px] font-semibold tracking-[0.16em] uppercase">
          排序
        </h4>
        <div className="bg-muted/60 grid grid-cols-2 gap-0.5 rounded-lg p-0.5">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              title={option.label}
              onClick={() => onSortChange(option.key)}
              className={cn(
                "rounded-md px-2 py-1.5 text-center text-xs leading-tight font-medium transition-colors",
                sort === option.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* 各面向 */}
      {FACETS.map((facet) => {
        const values = facets[facet.key] ?? [];
        if (values.length === 0) return null;
        const chosen = selected[facet.key];
        return (
          <section key={facet.key} className="flex flex-col gap-1.5">
            <h4 className="text-muted-foreground text-[10px] font-semibold tracking-[0.16em] uppercase">
              {facet.label}
            </h4>
            <div className="flex flex-col gap-px">
              {values.map(({ value, count }) => {
                const active = chosen?.has(value) ?? false;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onToggle(facet.key, value)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      active ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
                      !active && count === 0 && "opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-all",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input group-hover:border-muted-foreground"
                      )}
                    >
                      {active ? <Check className="size-3" strokeWidth={3.5} /> : null}
                    </span>
                    <span className="flex-1 truncate">{value}</span>
                    <span
                      className={cn(
                        "font-data text-xs tabular-nums",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
