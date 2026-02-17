/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { translations } from './translations';
import type { Language } from './translations';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: keyof typeof translations.en) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const user = useLiveQuery(() => db.users.orderBy('id').first());
    const [fallbackLanguage, setFallbackLanguage] = useState<Language>('en');
    const language = user?.language ?? fallbackLanguage;

    const setLanguage = async (lang: Language) => {
        if (user) {
            await db.users.update(user.id, { language: lang });
        } else {
            setFallbackLanguage(lang);
        }
    };

    const t = (key: keyof typeof translations.en) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
