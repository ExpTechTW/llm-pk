import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Cloud,
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
import { useI18n } from "@/lib/i18n";
import type { SubmissionRow } from "@/lib/types";

const FEATURES = [
  { icon: Scale, titleKey: "home.feat.fair.t", descKey: "home.feat.fair.d" },
  { icon: Users, titleKey: "home.feat.community.t", descKey: "home.feat.community.d" },
  { icon: Cpu, titleKey: "home.feat.local.t", descKey: "home.feat.local.d" }
] as const;

function LeadGroup({
  title,
  icon: Icon,
  rows
}: {
  title: string;
  icon: typeof Trophy;
  rows: SubmissionRow[];
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-[0.16em] uppercase">
        <Icon className="size-3.5" />
        {title}
      </div>
      {rows.length > 0 ? (
        rows.map((row, index) => (
          <SubmissionCard key={row.id} row={row} rank={index + 1} index={index} />
        ))
      ) : (
        <p className="text-muted-foreground/70 border-border/50 rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
          {t("home.empty")}
        </p>
      )}
    </div>
  );
}

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
  const { t } = useI18n();
  const { db } = useDb();

  const packs = useMemo(() => (db ? getPacks(db) : []), [db]);
  const all = useMemo<SubmissionRow[]>(
    () => (db ? packs.flatMap((p) => getSubmissionsByPack(db, p.name, p.ver)) : []),
    [db, packs]
  );

  const stats = useMemo(() => {
    const backends = new Set(all.map((r) => r.backendName).filter(Boolean));
    const contributors = new Set(all.map((r) => r.uploader).filter(Boolean));
    return {
      submissions: all.length,
      packs: packs.length,
      backends: backends.size,
      contributors: contributors.size
    };
  }, [all, packs]);

  const topLocal = useMemo(
    () =>
      [...all]
        .filter((r) => r.deployment !== "cloud")
        .sort((a, b) => b.scoreTotal - a.scoreTotal)
        .slice(0, 3),
    [all]
  );
  const topCloud = useMemo(
    () =>
      [...all]
        .filter((r) => r.deployment === "cloud")
        .sort((a, b) => b.scoreTotal - a.scoreTotal)
        .slice(0, 3),
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
              {t("lb.badge")}
            </span>
            <h1 className="hero-title font-display max-w-3xl font-extrabold tracking-tight">
              {t("home.hero.l1")}
              <span className="from-primary bg-gradient-to-r to-cyan-300 bg-clip-text text-transparent">
                {t("home.hero.l2")}
              </span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">{t("home.hero.desc")}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/leaderboard"
                className={buttonVariants({ size: "lg", className: "rounded-full" })}
              >
                <Trophy className="size-4" />
                {t("home.cta.leaderboard")}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#features"
                className={buttonVariants({ variant: "outline", size: "lg", className: "rounded-full" })}
              >
                {t("home.cta.how")}
              </a>
            </div>
          </section>

          {/* 即時數據 */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3">
            <StatCard label={t("home.stat.submissions")} value={String(stats.submissions)} icon={Trophy} />
            <StatCard label={t("home.stat.packs")} value={String(stats.packs)} icon={Layers} />
            <StatCard label={t("home.stat.contributors")} value={String(stats.contributors)} icon={Users} />
          </section>
        </div>

        {/* 往下滑提示 */}
        <a
          href="#explore"
          className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 pb-6 text-xs transition-colors"
        >
          {t("home.scroll")}
          <ChevronDown className="size-5 animate-bounce" />
        </a>
      </div>

      {/* 模型跑馬燈(左 / 右 / 左 交錯捲動) */}
      {all.length > 0 ? (
        <section id="explore" className="animate-rise -mx-4 mb-14 scroll-mt-20 overflow-x-clip py-2 pt-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-center pb-6">{t("home.community")}</h2>
          <ModelMarquee rows={all} />
        </section>
      ) : null}

      {/* 特色 */}
      <section id="features" className="scroll-mt-20 pt-20">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t("home.why")}</h2>
          <p className="text-muted-foreground text-sm">{t("home.why.sub")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.titleKey}
              className="border-border/60 bg-card/50 flex flex-col gap-3 rounded-2xl border p-6 backdrop-blur-sm"
            >
              <span className="from-primary/20 text-primary grid size-10 place-items-center rounded-xl bg-gradient-to-br to-cyan-400/10">
                <f.icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-bold tracking-tight">{t(f.titleKey)}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 排行預覽:本地 / 雲端 分開 */}
      {topLocal.length > 0 || topCloud.length > 0 ? (
        <section className="pt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t("home.lead.title")}</h2>
              <p className="text-muted-foreground text-sm">{t("home.lead.sub")}</p>
            </div>
            <Link
              to="/leaderboard"
              className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-1 text-sm font-medium"
            >
              {t("home.lead.full")} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-2">
            <LeadGroup title={t("val.local")} icon={Cpu} rows={topLocal} />
            <LeadGroup title={t("val.cloud")} icon={Cloud} rows={topCloud} />
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="border-border/60 bg-card/40 relative mt-20 overflow-hidden rounded-3xl border p-8 text-center backdrop-blur-sm sm:p-12">
        <div className="from-primary/[0.08] pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent" />
        <h2 className="font-display relative text-2xl font-bold tracking-tight sm:text-3xl">
          {t("home.cta2.title")}
        </h2>
        <p className="text-muted-foreground relative mx-auto mt-3 max-w-md text-sm leading-relaxed">
          {t("home.cta2.desc")}
        </p>
        <div className="relative mt-6 flex justify-center">
          <Link
            to="/leaderboard"
            className={buttonVariants({ size: "lg", className: "rounded-full" })}
          >
            {t("home.cta2.btn")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
