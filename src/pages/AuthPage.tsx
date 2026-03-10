import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/db';
import { getSessionUser, loginWithUsername, registerWithUsername } from '@/auth/session';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

type AuthMode = 'login' | 'register';

export function AuthPage() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();

    useEffect(() => {
        let mounted = true;

        const checkSession = async () => {
            const sessionUser = await getSessionUser();

            if (sessionUser && mounted) {
                navigate('/', { replace: true });
            }
        };

        void checkSession();

        return () => {
            mounted = false;
        };
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorKey(null);
        setIsSubmitting(true);

        try {
            const result = mode === 'login'
                ? await loginWithUsername(username.trim(), password)
                : await registerWithUsername(username.trim(), password);

            if (!result.ok || !result.user) {
                setErrorKey('auth.error.invalidCredentials');
                return;
            }

            await db.delete();
            await db.open();

            if (mode === 'register') {
                navigate('/onboarding', { replace: true });
                return;
            }

            await db.users.put({
                id: result.user.id,
                name: result.user.name || result.user.username,
                language: result.user.language,
                theme: result.user.theme
            });

            if (result.user.language) {
                await setLanguage(result.user.language);
            }

            navigate('/', { replace: true });
        } catch {
            setErrorKey('auth.error.generic');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col p-6">
            <div className="w-full max-w-md mx-auto flex justify-end mb-4">
                <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as 'en' | 'de')}
                    className="bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs p-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                    aria-label={t('settings.language')}
                >
                    <option value="en">{t('language.english')}</option>
                    <option value="de">{t('language.german')}</option>
                </select>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <form onSubmit={handleSubmit} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-5 shadow-xl">
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {mode === 'login' ? t('auth.title.login') : t('auth.title.register')}
                        </h1>
                        <p className="text-sm text-[var(--muted-foreground)]">
                            {mode === 'login' ? t('auth.subtitle.login') : t('auth.subtitle.register')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{t('auth.username')}</label>
                        <input
                            required
                            minLength={3}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                            autoComplete="username"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{t('auth.password')}</label>
                        <input
                            required
                            minLength={8}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        />
                    </div>

                    {errorKey && (
                        <p className="text-sm text-red-500">{t(errorKey)}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[var(--primary)] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
                    >
                        {isSubmitting ? t('auth.submitting') : mode === 'login' ? t('auth.login') : t('auth.register')}
                    </button>

                    <p className="w-full text-sm text-center text-[var(--muted-foreground)]">
                        <span>{mode === 'login' ? t('auth.switchToRegister.prompt') : t('auth.switchToLogin.prompt')} </span>
                        <button
                            type="button"
                            className="text-[var(--foreground)] underline underline-offset-2 hover:opacity-80"
                            onClick={() => {
                                setMode(prev => prev === 'login' ? 'register' : 'login');
                                setErrorKey(null);
                            }}
                        >
                            {mode === 'login' ? t('auth.register') : t('auth.login')}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}
