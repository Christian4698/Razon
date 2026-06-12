import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLanguage,
  englishFallback,
  languages,
  translations,
  type LanguageCode,
  type LanguageDefinition,
} from "./translations";

const storageKey = "razon.language";

interface TranslateOptions {
  values?: Record<string, string | number>;
}

interface LanguageContextValue {
  language: LanguageCode;
  languageDefinition: LanguageDefinition;
  languages: LanguageDefinition[];
  dir: "ltr" | "rtl";
  locale: string;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, options?: TranslateOptions) => string;
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value && languages.some(language => language.code === value));
}

function detectLanguage(): LanguageCode {
  if (typeof window === "undefined") return defaultLanguage;

  const stored = window.localStorage.getItem(storageKey);
  if (isLanguageCode(stored)) return stored;

  return defaultLanguage;
}

function interpolate(value: string, options?: TranslateOptions) {
  if (!options?.values) return value;

  return Object.entries(options.values).reduce(
    (output, [key, replacement]) => output.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => detectLanguage());
  const languageDefinition =
    languages.find(item => item.code === language) ??
    languages.find(item => item.code === defaultLanguage)!;

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(storageKey, nextLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = languageDefinition.locale;
    document.documentElement.dir = languageDefinition.dir;
  }, [languageDefinition.dir, languageDefinition.locale]);

  const t = useCallback(
    (key: string, options?: TranslateOptions) => {
      const translationKey = key as keyof typeof englishFallback;
      const value =
        translations[language][translationKey] ??
        englishFallback[translationKey] ??
        key;

      return interpolate(value, options);
    },
    [language]
  );

  const formatNumber = useCallback(
    (value: number | null | undefined, options?: Intl.NumberFormatOptions) => {
      if (typeof value !== "number" || Number.isNaN(value)) return t("common.unavailable");

      return new Intl.NumberFormat(languageDefinition.locale, options).format(value);
    },
    [languageDefinition.locale, t]
  );

  const formatDate = useCallback(
    (value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      if (!value) return t("common.unavailable");

      const date = typeof value === "string" ? new Date(value) : value;
      if (Number.isNaN(date.getTime())) return t("common.unavailable");

      return new Intl.DateTimeFormat(languageDefinition.locale, options).format(date);
    },
    [languageDefinition.locale, t]
  );

  const contextValue = useMemo<LanguageContextValue>(
    () => ({
      language,
      languageDefinition,
      languages,
      dir: languageDefinition.dir,
      locale: languageDefinition.locale,
      setLanguage,
      t,
      formatNumber,
      formatDate,
    }),
    [formatDate, formatNumber, language, languageDefinition, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}
