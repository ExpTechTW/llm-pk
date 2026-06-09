import { Check, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      {/* 排序 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">排序</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={sort === option.key ? "default" : "outline"}
              onClick={() => onSortChange(option.key)}
              className="px-2 text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">篩選</h3>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <RotateCcw className="size-3" />
            清除 {activeCount}
          </button>
        ) : null}
      </div>

      {/* 各面向 */}
      {FACETS.map((facet) => {
        const values = facets[facet.key] ?? [];
        if (values.length === 0) return null;
        const chosen = selected[facet.key];
        return (
          <section key={facet.key} className="flex flex-col gap-1.5">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {facet.label}
            </h4>
            <div className="flex flex-col gap-0.5">
              {values.map(({ value, count }) => {
                const active = chosen?.has(value) ?? false;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onToggle(facet.key, value)}
                    className={cn(
                      "group hover:bg-accent flex items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors",
                      active && "bg-accent"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input group-hover:border-ring"
                        )}
                      >
                        {active ? <Check className="size-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="truncate">{value}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
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
