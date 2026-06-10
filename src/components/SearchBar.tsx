import { Search } from "lucide-react";

import { useI18n } from "@/lib/i18n";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useI18n();
  return (
    <div className="group relative w-full max-w-xl">
      <div className="from-primary/40 absolute -inset-px rounded-2xl bg-gradient-to-r to-cyan-400/30 opacity-0 blur-md transition-opacity duration-300 group-focus-within:opacity-100" />
      <div className="bg-card/70 border-border/70 group-focus-within:border-primary/60 relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-xl transition-colors">
        <Search className="text-muted-foreground group-focus-within:text-primary size-5 shrink-0 transition-colors" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              onChange("");
              e.currentTarget.blur();
            }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="placeholder:text-muted-foreground/70 w-full bg-transparent text-[15px] outline-none"
        />
        {value ? (
          <kbd className="text-muted-foreground border-border/70 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:block">
            ESC
          </kbd>
        ) : null}
      </div>
    </div>
  );
}
