import { Link, Outlet } from "react-router-dom";
import { Trophy } from "lucide-react";

export function Layout() {
  return (
    <div className="from-background to-muted/20 min-h-screen bg-gradient-to-b">
      <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            <span className="font-semibold tracking-wide">LLM PK</span>
          </Link>
          <span className="text-muted-foreground ml-auto text-xs">本地模型跑分排行</span>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
