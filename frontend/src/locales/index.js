import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Simple translations for now
const en = { translation: { app: { name: 'FieldSync' } } };
const am = { translation: { app: { name: 'ፊልድሲንክ' } } };
const om = { translation: { app: { name: 'FieldSync' } } };
const ti = { translation: { app: { name: 'ፊልድሲንክ' } } };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, am, om, ti },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;