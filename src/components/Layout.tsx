import { Link, Outlet } from "react-router-dom";
import { Trophy } from "lucide-react";

export function Layout() {
  return (
    <div className="relative min-h-screen">
      <div className="bg-atmosphere" aria-hidden />

      <div className="relative z-10">
        <header className="border-border/50 bg-background/70 sticky top-0 z-30 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-15 max-w-[1480px] items-center gap-3 px-5 py-2.5">
            <Link to="/" className="group flex items-center gap-2.5">
              <span className="flex flex-col leading-none">
                <span className="font-display text-2xl font-extrabold tracking-tight">
                  LLM{" "}
                  <span className="from-primary bg-gradient-to-r to-cyan-300 bg-clip-text text-transparent">
                    PK
                  </span>
                </span>
                <span className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
                  local bench
                </span>
              </span>
            </Link>
            <Link
              to="/leaderboard"
              className="text-muted-foreground hover:text-foreground hover:border-primary/50 border-border/60 bg-card/50 ml-auto inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
            >
              <Trophy className="size-4" />
              排行榜
            </Link>
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
