import { useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import {
  FACETS,
  PRICE_FIELDS,
  SORT_OPTIONS,
  countPriceActive,
  countSelected,
  type FacetValueCount,
  type PriceBounds,
  type PriceRange,
  type PriceRanges,
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
  priceBounds: PriceBounds;
  priceRanges: PriceRanges;
  onPriceChange: (key: string, range: PriceRange) => void;
}

// 價格步進:依區間大小選一個順手的粒度。
function priceStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 2) return 0.01;
  if (span <= 20) return 0.1;
  return 1;
}

function fmtPrice(v: number): string {
  return `$${Number.isInteger(v) ? v : Number(v.toFixed(2))}`;
}

// 可展開 / 縮起的分類區塊。
function Section({
  title,
  titleSize = "text-[10px]",
  open,
  onToggle,
  bodyGap = "gap-1.5",
  children
}: {
  title: string;
  titleSize?: string;
  open: boolean;
  onToggle: () => void;
  bodyGap?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col", bodyGap)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn("text-muted-foreground hover:text-foreground -mx-1 flex items-center justify-between rounded px-1 py-0.5 font-semibold tracking-[0.16em] uppercase transition-colors", titleSize)}
      >
        <span>{title}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      {open ? children : null}
    </section>
  );
}

export function FilterSidebar({
  facets,
  selected,
  onToggle,
  onReset,
  sort,
  onSortChange,
  priceBounds,
  priceRanges,
  onPriceChange
}: FilterSidebarProps) {
  const activeCount = countSelected(selected) + countPriceActive(priceRanges, priceBounds);
  const priceKeys = PRICE_FIELDS.filter((f) => priceBounds[f.key]);

  // 各分類的收合狀態:預設只有「排序」與「部署」展開,其餘(各面向 + 價格)收起。
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set([...FACETS.map((f) => f.key).filter((k) => k !== "deployment"), "price"])
  );
  const isOpen = (key: string) => !collapsed.has(key);
  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
      <Section title="排序" titleSize="text-sm" open={isOpen("sort")} onToggle={() => toggleSection("sort")} bodyGap="gap-2">
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
      </Section>

      {/* 各面向 */}
      {FACETS.map((facet) => {
        const values = facets[facet.key] ?? [];
        if (values.length === 0) return null;
        const chosen = selected[facet.key];
        return (
          <Section
            key={facet.key}
            title={facet.label}
            titleSize="text-sm"
            open={isOpen(facet.key)}
            onToggle={() => toggleSection(facet.key)}
          >
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
          </Section>
        );
      })}

      {/* 價格區間(拉桿) */}
      {priceKeys.length > 0 ? (
        <Section
          title="價格"
          titleSize="text-sm"
          open={isOpen("price")}
          onToggle={() => toggleSection("price")}
          bodyGap="gap-4"
        >
          {priceKeys.map((f) => {
            const [lo, hi] = priceBounds[f.key];
            const range = priceRanges[f.key] ?? [lo, hi];
            return (
              <div key={f.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-data text-foreground tabular-nums">
                    {fmtPrice(range[0])} – {fmtPrice(range[1])}
                  </span>
                </div>
                <Slider
                  min={lo}
                  max={hi}
                  step={priceStep(lo, hi)}
                  value={range}
                  onValueChange={(v) => onPriceChange(f.key, [v[0], v[1]])}
                  aria-label={`${f.label}價格區間`}
                />
              </div>
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}
