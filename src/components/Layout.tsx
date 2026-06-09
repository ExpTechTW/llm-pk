import { Link, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="relative min-h-screen">
      <div className="bg-atmosphere" aria-hidden />

      <div className="relative z-10">
        <header className="border-border/50 bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-15 max-w-[1480px] items-center gap-3 px-5 py-2.5">
            <Link to="/" className="group flex items-center gap-2.5">
              <span className="bg-primary text-primary-foreground font-display grid size-8 place-items-center rounded-lg text-base font-extrabold shadow-[0_0_20px_-4px_var(--color-primary)]">
                ⚡
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-[15px] font-extrabold tracking-tight">LLM PK</span>
                <span className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
                  local bench
                </span>
              </span>
            </Link>
            <span className="text-muted-foreground ml-auto hidden text-xs tracking-wide sm:block">
              本地模型 · 量化 · 後端 · 硬體 跑分排行
            </span>
          </div>
        </header>

        <Outlet />

        <footer className="border-border/40 mx-auto mt-10 max-w-[1480px] border-t px-5 py-8">
          <p className="text-muted-foreground text-center text-xs">
            資料由 BenchLocal 產生 · 排行依 BenchLocal 分數
          </p>
        </footer>
      </div>
    </div>
  );
}
