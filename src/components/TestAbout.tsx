import { useMemo } from "react";

import { useI18n } from "@/lib/i18n";
import type { ExamPack } from "@/lib/exam";

export interface AboutCat {
  id: string;
  label?: string;
  weight?: number;
}

/**
 * 「這個測試在測什麼」說明卡:每個類別一張卡,顯示類別名稱 / 配分,
 * 以及該類別底下的實際題目(標題 + 評分標準),直接用題庫內容說明測試意義。
 */
export function TestAbout({ cats, exam }: { cats: AboutCat[]; exam: ExamPack | null }) {
  const { t, catLabel } = useI18n();

  // 依類別把題目分組(維持題庫原始順序,如 TC-01、TC-02…)。
  const byCat = useMemo(() => {
    const m = new Map<string, { sid: string; q: ExamPack["scenarios"][string] }[]>();
    if (exam) {
      for (const [sid, q] of Object.entries(exam.scenarios)) {
        const c = q.category ?? "";
        if (!m.has(c)) m.set(c, []);
        m.get(c)!.push({ sid, q });
      }
    }
    return m;
  }, [exam]);

  if (cats.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cats.map((c) => {
        const items = byCat.get(c.id) ?? [];
        const label = catLabel(c.label ?? c.id);
        return (
          <div
            key={c.id}
            className="border-border/60 bg-card/50 flex flex-col gap-2.5 rounded-xl border p-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="font-data bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold">
                {c.id}
              </span>
              <span className="font-display min-w-0 flex-1 truncate text-sm font-bold" title={label}>
                {label}
              </span>
              {c.weight != null ? (
                <span className="text-muted-foreground font-data shrink-0 text-xs tabular-nums">
                  {c.weight}%
                </span>
              ) : null}
            </div>

            {items.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {items.map(({ sid, q }) => (
                  <li key={sid} className="text-xs leading-relaxed">
                    <span className="text-foreground font-medium">{q.title ?? sid}</span>
                    {q.criteria && q.criteria.length > 0 ? (
                      <span className="text-muted-foreground"> — {q.criteria.join(" · ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">{t("lb.about.empty")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
