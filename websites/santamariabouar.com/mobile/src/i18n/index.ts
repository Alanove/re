import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { tokenStorage } from '@/auth/tokenStorage';
import en from './en';
import fr from './fr';

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_KEY = 'smb.language';

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'fr' ? 'fr' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export async function loadSavedLanguage(): Promise<void> {
  const saved = await tokenStorage.getItem(LANGUAGE_KEY);
  if (saved === 'en' || saved === 'fr') await i18n.changeLanguage(saved);
}

export async function setLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
  await tokenStorage.setItem(LANGUAGE_KEY, language);
}

export default i18n;
