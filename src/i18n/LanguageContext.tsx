/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import type { ProfileFields } from '@shared/commands';
import { translations } from './translations';
import type { Language } from './translations';
import type { TranslationKey } from './translations';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    timeFormat: ProfileFields['timeFormat'];
    setTimeFormat: (format: ProfileFields['timeFormat']) => Promise<void>;
    formatTime: (timestamp: number) => string;
    formatDateTime: (timestamp: number) => string;
    t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const { database: db, defaultTimeFormat } = useSession();
    const user = useLiveQuery(() => db?.users.get(db.binding.accountId), [db]);
    const [fallbackLanguage, setFallbackLanguage] = useState<Language>('en');
    const language = user?.language ?? fallbackLanguage;
    const [fallbackTimeFormat, setFallbackTimeFormat] = useState<ProfileFields['timeFormat']>('system');
    const timeFormat = user?.timeFormat ?? fallbackTimeFormat;
    const resolvedTimeFormat = timeFormat === 'system' ? defaultTimeFormat : timeFormat;
    // Account override > server default > browser locale, independently of UI language.
    const use12Hours = resolvedTimeFormat === 'system'
        ? new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12
        : resolvedTimeFormat === '12h';
    // Explicit cycles ensure midnight is 00:00 (24h) or 12:00 AM (12h).
    const hourCycle = use12Hours ? 'h12' : 'h23';
    const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString(language, {
        hour: '2-digit', minute: '2-digit', hourCycle,
    });
    const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString(language, {
        dateStyle: 'medium', timeStyle: 'short', hourCycle,
    });

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

    const setTimeFormat = async (format: ProfileFields['timeFormat']) => {
        if (user && db) {
            await applyOperation(db, 'profile.update', null, { timeFormat: format });
        } else {
            setFallbackTimeFormat(format);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, timeFormat, setTimeFormat, formatTime, formatDateTime, t }}>
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
