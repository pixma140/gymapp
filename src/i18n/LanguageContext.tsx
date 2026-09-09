/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import { translations } from './translations';
import type { Language } from './translations';
import type { TranslationKey } from './translations';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const { database: db } = useSession();
    const user = useLiveQuery(() => db?.users.get(db.binding.accountId), [db]);
    const [fallbackLanguage, setFallbackLanguage] = useState<Language>('en');
    const language = user?.language ?? fallbackLanguage;

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const setLanguage = async (lang: Language) => {
        if (user && db) {
            await applyOperation(db, 'profile.update', null, { language: lang });
        } else {
            setFallbackLanguage(lang);
        }
    };

    const t = (key: TranslationKey) => {
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
