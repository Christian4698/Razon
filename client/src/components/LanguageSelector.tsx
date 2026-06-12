import { Languages } from "lucide-react";
import { useLanguage } from "@/i18n/useLanguage";
import type { LanguageCode } from "@/i18n/translations";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  compact?: boolean;
}

export default function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { language, languages, setLanguage, t } = useLanguage();

  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground",
        compact && "px-2 py-1"
      )}
    >
      <Languages className="h-4 w-4 text-accent" />
      <span className="sr-only">{t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        className="min-w-0 bg-transparent text-sm font-medium outline-none"
        value={language}
        onChange={event => setLanguage(event.target.value as LanguageCode)}
      >
        {languages.map(item => (
          <option key={item.code} value={item.code} className="bg-card text-foreground">
            {item.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
