import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, Trophy } from "lucide-react";

import { FilterSidebar } from "@/components/FilterSidebar";
import { SearchBar } from "@/components/SearchBar";
import { SubmissionCard } from "@/components/SubmissionCard";
import { Button } from "@/components/ui/button";
import { getPacks, getSubmissionsByPack } from "@/lib/db";
import {
  applyFilters,
  computeFacets,
  countSelected,
  emptySelected,
  type Selected,
  type SortKey
} from "@/lib/filters";
import { useDb } from "@/hooks/useDb";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

export default function App() {
  const { db, loading, error } = useDb();
  const [pack, setPack] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected>(emptySelected);
  const [sort, setSort] = useState<SortKey>("score");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  const packs = useMemo(() => (db ? getPacks(db) : []), [db]);
  const rows = useMemo(() => (db && pack ? getSubmissionsByPack(db, pack) : []), [db, pack]);
  const facets = useMemo(() => computeFacets(rows, search, selected), [rows, search, selected]);
  const filtered = useMemo(
    () => applyFilters(rows, search, selected, sort),
    [rows, search, selected, sort]
  );

  useEffect(() => {
    if (!pack && packs.length > 0) setPack(packs[0].name);
  }, [packs, pack]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [pack, search, selected, sort]);

  const changePack = (name: string) => {
    setPack(name);
    setSelected(emptySelected());
  };

  const toggle = (facetKey: string, value: string) => {
    setSelected((prev) => {
      const next: Selected = { ...prev };
      const set = new Set(next[facetKey]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[facetKey] = set;
      return next;
    });
  };

  const activeFilters = countSelected(selected);

  return (
    <div className="from-background to-muted/20 min-h-screen bg-gradient-to-b">
      {/* Navbar */}
      <header className="border-border/60 bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Trophy className="size-5 text-amber-500" />
          <span className="font-semibold tracking-wide">LLM PK</span>
          <span className="text-muted-foreground ml-auto text-xs">本地模型跑分排行</span>
        </div>
      </header>

      {/* Hero + 搜尋 */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-12 pb-8">
        <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          本地模型{" "}
          <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">
            跑分排行
          </span>
        </h1>
        <p className="text-muted-foreground max-w-xl text-center text-sm">
          比較不同模型、量化、推理後端與硬體的 BenchLocal 成績
        </p>
        <SearchBar value={search} onChange={setSearch} />
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="size-4 animate-spin" />
            載入資料庫中…
          </div>
        ) : error ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive mx-auto max-w-md rounded-xl border p-6 text-center text-sm">
            <p className="font-medium">無法載入排行榜</p>
            <p className="mt-1 opacity-80">{error}</p>
            <p className="text-muted-foreground mt-3 text-xs">
              請先執行 <code className="font-mono">npm run build:db</code> 產生 public/data.db。
            </p>
          </div>
        ) : !db || packs.length === 0 ? (
          <div className="text-muted-foreground mx-auto max-w-md rounded-xl border p-10 text-center text-sm">
            目前沒有任何投稿資料。把 score.json 放進{" "}
            <code className="font-mono">data/&#123;pack&#125;/&#123;ver&#125;/</code> 後重新建置即可。
          </div>
        ) : (
          <>
            {/* Pack 選擇器 */}
            {packs.length > 1 ? (
              <div className="mb-5 flex flex-wrap justify-center gap-2">
                {packs.map((p) => (
                  <Button
                    key={p.name}
                    size="sm"
                    variant={p.name === pack ? "default" : "outline"}
                    onClick={() => changePack(p.name)}
                    className="rounded-full"
                  >
                    {p.name}
                    <span className="opacity-60">{p.count}</span>
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="lg:grid lg:grid-cols-[248px_1fr] lg:gap-6">
              {/* 篩選側欄 */}
              <aside className="lg:block">
                <div className="mb-3 lg:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters((v) => !v)}
                    className="w-full"
                  >
                    <SlidersHorizontal className="size-4" />
                    篩選與排序{activeFilters > 0 ? ` · ${activeFilters}` : ""}
                  </Button>
                </div>
                <div
                  className={cn(
                    "lg:sticky lg:top-20 lg:block",
                    showFilters ? "block" : "hidden"
                  )}
                >
                  <div className="border-border/60 bg-card/40 mb-4 rounded-xl border p-4 lg:mb-0">
                    <FilterSidebar
                      facets={facets}
                      selected={selected}
                      onToggle={toggle}
                      onReset={() => setSelected(emptySelected())}
                      sort={sort}
                      onSortChange={setSort}
                    />
                  </div>
                </div>
              </aside>

              {/* 排行清單 */}
              <div className="flex flex-col gap-3">
                <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
                  <span>
                    {search.trim() || activeFilters > 0 ? "符合條件" : "全部投稿"} {filtered.length} 筆
                  </span>
                  <span>共 {rows.length} 筆</span>
                </div>

                {filtered.length === 0 ? (
                  <div className="text-muted-foreground rounded-xl border py-12 text-center text-sm">
                    找不到符合條件的投稿。
                  </div>
                ) : (
                  <>
                    {filtered.slice(0, visible).map((row, index) => (
                      <SubmissionCard key={row.id} row={row} rank={index + 1} />
                    ))}
                    {filtered.length > visible ? (
                      <Button
                        variant="outline"
                        onClick={() => setVisible((v) => v + PAGE_SIZE)}
                        className="mt-1 self-center"
                      >
                        顯示更多({filtered.length - visible})
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
