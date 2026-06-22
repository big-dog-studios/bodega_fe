import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import bn from './locales/bn.json';
import el from './locales/el.json';
import ht from './locales/ht.json';
import ko from './locales/ko.json';

/** Every locale we ship. `en` is the source of truth and the fallback. */
export const SUPPORTED_LANGS = ['en', 'es', 'zh', 'ru', 'bn', 'el', 'ht', 'ko'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const resources = {
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  ru: { translation: ru },
  bn: { translation: bn },
  el: { translation: el },
  ht: { translation: ht },
  ko: { translation: ko },
};

/**
 * Pick the best supported language from the device's preference list. We match
 * on the primary subtag only (e.g. `zh-CN`, `zh-Hans` → `zh`), walking the
 * device's ordered preferences and falling back to English if none match.
 * Detection is one-shot at launch — there's no in-app switcher by design.
 */
export function detectLanguage(): Lang {
  const prefs =
    typeof navigator !== 'undefined'
      ? navigator.languages?.length
        ? navigator.languages
        : [navigator.language]
      : [];
  for (const pref of prefs) {
    if (!pref) continue;
    const primary = pref.toLowerCase().split('-')[0];
    const match = SUPPORTED_LANGS.find((l) => l === primary);
    if (match) return match;
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // Missing keys fall back to the English string rather than rendering the key.
  returnNull: false,
});

export default i18n;
