import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Cpu,
  Layers,
  Scale,
  Trophy,
  Users
} from "lucide-react";

import { ModelMarquee } from "@/components/ModelMarquee";
import { SubmissionCard } from "@/components/SubmissionCard";
import { buttonVariants } from "@/components/ui/button";
import { getPacks, getSubmissionsByPack } from "@/lib/db";
import { useDb } from "@/hooks/useDb";
import type { SubmissionRow } from "@/lib/types";

const FEATURES = [
  {
    icon: Scale,
    title: "公平對照",
    desc: "同一份測試題組,跨模型、量化、推理,在一致的標準下直接比較。"
  },
  {
    icon: Users,
    title: "社群跑分",
    desc: "成績由社群成員實際跑測後投稿,涵蓋各種真實的本地部署組合。"
  },
  {
    icon: Cpu,
    title: "本地優先",
    desc: "聚焦本地部署與量化效能,讓你看清楚每個組合在自己機器上的真實表現。"
  }
] as const;

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Trophy }) {
  return (
    <div className="border-border/60 bg-card/50 flex flex-col gap-2 rounded-2xl border p-5 backdrop-blur-sm">
      <Icon className="text-primary size-5" />
      <span className="font-data text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

export default function Home() {
  const { db } = useDb();

  const packs = useMemo(() => (db ? getPacks(db) : []), [db]);
  const all = useMemo<SubmissionRow[]>(
    () => (db ? packs.flatMap((p) => getSubmissionsByPack(db, p.name, p.ver)) : []),
    [db, packs]
  );

  const stats = useMemo(() => {
    const backends = new Set(all.map((r) => r.backendName).filter(Boolean));
    const contributors = new Set(all.map((r) => r.author).filter(Boolean));
    return {
      submissions: all.length,
      packs: packs.length,
      backends: backends.size,
      contributors: contributors.size
    };
  }, [all, packs]);

  const top3 = useMemo(
    () => [...all].sort((a, b) => b.scoreTotal - a.scoreTotal).slice(0, 3),
    [all]
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-24 space-y-6">
      {/* 首屏:Hero + 即時數據 填滿第一個視窗;跑馬燈與其餘內容需往下捲動 */}
      <div className="flex min-h-[calc(100dvh-3.75rem)] flex-col">
        {/* Hero + 即時數據 一起置中,彼此靠近 */}
        <div className="flex flex-1 flex-col justify-center gap-10 py-10">
          <section className="animate-rise flex flex-col items-center gap-6 text-center">
            <span className="border-border/60 bg-card/50 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs backdrop-blur">
              <span className="bg-primary size-1.5 animate-pulse rounded-full" />
              BenchLocal 社群跑分
            </span>
            <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              本地模型,
              <span className="from-primary bg-gradient-to-r to-cyan-300 bg-clip-text text-transparent">
                一份測試見真章
              </span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              同一份測試題組,跨模型、量化、推理的公平對照。
              由社群實測投稿,透明、可重現的本地模型跑分排行。
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/leaderboard"
                className={buttonVariants({ size: "lg", className: "rounded-full" })}
              >
                <Trophy className="size-4" />
                查看排行榜
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#features"
                className={buttonVariants({ variant: "outline", size: "lg", className: "rounded-full" })}
              >
                了解運作方式
              </a>
            </div>
          </section>

          {/* 即時數據 */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3">
            <StatCard label="模型投稿" value={String(stats.submissions)} icon={Trophy} />
            <StatCard label="測試套件" value={String(stats.packs)} icon={Layers} />
            <StatCard label="社群貢獻者" value={String(stats.contributors)} icon={Users} />
          </section>
        </div>

        {/* 往下滑提示 */}
        <a
          href="#explore"
          className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 pb-6 text-xs transition-colors"
        >
          往下滑
          <ChevronDown className="size-5 animate-bounce" />
        </a>
      </div>

      {/* 模型跑馬燈(左 / 右 / 左 交錯捲動) */}
      {all.length > 0 ? (
        <section id="explore" className="animate-rise relative left-1/2 mb-14 w-screen -translate-x-1/2 scroll-mt-20 py-2 pt-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-center pb-6">強大的社群</h2>
          <ModelMarquee rows={all} />
        </section>
      ) : null}

      {/* 特色 */}
      <section id="features" className="scroll-mt-20 pt-20">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">為什麼用 LLM PK?</h2>
          <p className="text-muted-foreground text-sm">把分散的本地跑分,收斂成可以直接比較的一張表。</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border-border/60 bg-card/50 flex flex-col gap-3 rounded-2xl border p-6 backdrop-blur-sm"
            >
              <span className="from-primary/20 text-primary grid size-10 place-items-center rounded-xl bg-gradient-to-br to-cyan-400/10">
                <f.icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 排行預覽 */}
      {top3.length > 0 ? (
        <section className="pt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">目前領先</h2>
              <p className="text-muted-foreground text-sm">綜合分數最高的本地模型組合。</p>
            </div>
            <Link
              to="/leaderboard"
              className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-1 text-sm font-medium"
            >
              完整排行 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {top3.map((row, index) => (
              <SubmissionCard key={row.id} row={row} rank={index + 1} index={index} />
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="border-border/60 bg-card/40 relative mt-20 overflow-hidden rounded-3xl border p-8 text-center backdrop-blur-sm sm:p-12">
        <div className="from-primary/[0.08] pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent" />
        <h2 className="font-display relative text-2xl font-bold tracking-tight sm:text-3xl">
          想讓你的模型上榜?
        </h2>
        <p className="text-muted-foreground relative mx-auto mt-3 max-w-md text-sm leading-relaxed">
          用 BenchLocal 跑完同一份測試,把 score.json 投稿進來,就能加入排行對照。
        </p>
        <div className="relative mt-6 flex justify-center">
          <Link
            to="/leaderboard"
            className={buttonVariants({ size: "lg", className: "rounded-full" })}
          >
            先看看排行榜
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
