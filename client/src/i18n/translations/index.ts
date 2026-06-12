import { en } from "../en";
import { fr } from "../fr";

export type LanguageCode = "en" | "fr";
export type TranslationKey = keyof typeof en;

export interface LanguageDefinition {
  code: LanguageCode;
  nativeName: string;
  locale: string;
  dir: "ltr" | "rtl";
}

export const languages: LanguageDefinition[] = [
  { code: "en", nativeName: "English", locale: "en-US", dir: "ltr" },
  { code: "fr", nativeName: "Français", locale: "fr-FR", dir: "ltr" },
];

export const defaultLanguage: LanguageCode = "en";

export const translations: Record<LanguageCode, Partial<Record<TranslationKey, string>>> = {
  en,
  fr,
};

export const englishFallback = en;
