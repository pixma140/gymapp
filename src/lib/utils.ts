import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Exercise } from '@/db/db';
import { translations, type TranslationKey } from '@/i18n/translations';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Translates a value if it matches a known i18n key.
 * Falls back to the English translation, then the raw value.
 */
export function translateValue(
    value: string,
    t: (key: TranslationKey) => string,
): string {
    const key = value as TranslationKey;
    const translated = t(key);
    if (translated !== value) return translated;
    const enFallback = translations.en[key];
    if (enFallback) return enFallback;
    return value;
}

/**
 * Returns the translated exercise name if the name is a known translation key,
 * otherwise returns the raw name (for user-created exercises).
 */
export function getExerciseDisplayName(
    exercise: Pick<Exercise, 'name'>,
    t: (key: TranslationKey) => string,
): string {
    return translateValue(exercise.name, t);
}
