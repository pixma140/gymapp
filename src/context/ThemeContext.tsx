/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

export type Theme = 'light' | 'dark' | 'oled' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => Promise<void>;
    resolvedTheme: 'light' | 'dark' | 'oled';
    mainColor: string;
    setColor: (color: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const user = useLiveQuery(() => db.users.orderBy('id').first());
    const [fallbackTheme, setFallbackTheme] = useState<Theme>('dark');
    const [fallbackMainColor, setFallbackMainColor] = useState<string>('#2563eb'); // Default blue-600
    const theme = user?.theme ?? fallbackTheme;
    const mainColor = user?.mainColor ?? fallbackMainColor;
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark' | 'oled'>('dark');

    // specific effect to update the resolved theme based on system perference
    useEffect(() => {
        const root = window.document.documentElement;

        const updateTheme = () => {
            let targetTheme = theme;

            if (theme === 'system') {
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                targetTheme = systemTheme;
            }

            setResolvedTheme(targetTheme as 'light' | 'dark' | 'oled');

            root.classList.remove('light', 'dark', 'oled');
            root.classList.add(targetTheme);

            // Apply main color variables
            root.style.setProperty('--primary', mainColor);
            // Simple logic for foreground color on primary - for now assume white text on colored buttons
            root.style.setProperty('--primary-foreground', '#ffffff');

            // Apply ring color (usually same as primary or similar)
            root.style.setProperty('--ring', mainColor);

            // For OLED mode, we might want to set a specific class or let CSS handle it via .oled
        };

        updateTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (theme === 'system') updateTheme();
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme, mainColor]);

    const setTheme = async (newTheme: Theme) => {
        if (user) {
            await db.users.update(user.id, { theme: newTheme });
        } else {
            setFallbackTheme(newTheme);
        }
    };

    const setColor = async (color: string) => {
        if (user) {
            await db.users.update(user.id, { mainColor: color });
        } else {
            setFallbackMainColor(color);
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, mainColor, setColor }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
