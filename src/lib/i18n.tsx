import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "zh" | "en" | "ja";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "zh", label: "中" },
  { code: "en", label: "EN" },
  { code: "ja", label: "日" }
];

const STORAGE_KEY = "llm-pk-lang";

interface LocaleData {
  messages: Record<string, string>;
  categories: Record<string, string>;
}

// 每個語系獨立 chunk,只動態載入「目前選的」語言,減少初始下載。
const loaders: Record<Lang, () => Promise<LocaleData>> = {
  zh: () => import("./locales/zh"),
  en: () => import("./locales/en"),
  ja: () => import("./locales/ja")
};

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "zh" || saved === "en" || saved === "ja") return saved;
  } catch {
    /* 無 localStorage */
  }
  const n = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "zh";
  if (n.startsWith("ja")) return "ja";
  if (n.startsWith("zh")) return "zh";
  return n.startsWith("en") ? "en" : "zh";
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
  catLabel: (label: string) => string; // 類別名(資料端英文)→ 當前語言;無對照回原文
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const [data, setData] = useState<LocaleData | null>(null);

  useEffect(() => {
    let alive = true;
    loaders[lang]().then((m) => {
      if (alive) setData({ messages: m.messages, categories: m.categories });
    });
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : lang;
    return () => {
      alive = false;
    };
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const messages = data?.messages ?? {};
    const categories = data?.categories ?? {};
    const t: TFn = (key, vars) => interpolate(messages[key] ?? key, vars);
    const catLabel = (label: string) => categories[label] ?? label;
    return { lang, setLang: setLangState, t, catLabel };
  }, [lang, data]);

  // 首次載入語系 chunk 前不渲染(檔案很小,幾乎無感);切換語言時保留舊資料避免閃爍。
  if (!data) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n 必須在 <I18nProvider> 內使用");
  return ctx;
}
