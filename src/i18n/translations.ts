import { de } from './locales/de';
import { en } from './locales/en';
import type { TranslationKey } from './locales/en';

export type Language = 'en' | 'de';
export type { TranslationKey };

export const translations: Record<Language, Record<TranslationKey, string>> = { en, de };
