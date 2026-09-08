import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOidcStatus, loginWithUsername, registerWithUsername, startOidcLogin } from '@/auth/session';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSession } from '@/context/SessionContext';
import type { TranslationKey } from '@/i18n/translations';

type AuthMode = 'login' | 'register';

export function AuthPage() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();
    const { refresh } = useSession();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('oidc_error')) {
            setErrorKey('auth.oidc.error');
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        void getOidcStatus().then((enabled) => {
            if (mounted) {
                setOidcEnabled(enabled);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorKey(null);

        if (mode === 'register' && password !== confirmPassword) {
            setErrorKey('auth.error.passwordMismatch');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = mode === 'login'
                ? await loginWithUsername(username.trim(), password)
                : await registerWithUsername(username.trim(), password);

            if (!result.ok || !result.user) {
                setErrorKey('auth.error.invalidCredentials');
                return;
            }

            // Make the new session known to the app, then let RequireAuth
            // reconcile/hydrate the local database for this account.
            await refresh();

            const channel = new BroadcastChannel('gymapp-session');
            channel.postMessage('changed'); channel.close();

            navigate(mode === 'register' ? '/onboarding' : '/', { replace: true });
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

                    {mode === 'register' && (
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{t('auth.confirmPassword')}</label>
                            <input
                                required
                                minLength={8}
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                                autoComplete="new-password"
                            />
                        </div>
                    )}

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

                    {oidcEnabled && (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="h-px flex-1 bg-[var(--border)]" />
                                <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{t('auth.oidc.divider')}</span>
                                <span className="h-px flex-1 bg-[var(--border)]" />
                            </div>

                            <button
                                type="button"
                                onClick={() => startOidcLogin()}
                                className="w-full border border-[var(--border)] bg-[var(--input)] hover:bg-[var(--accent)] text-[var(--foreground)] py-3 rounded-xl font-semibold transition-colors"
                            >
                                {t('auth.oidc.login')}
                            </button>
                        </>
                    )}

                    <p className="w-full text-sm text-center text-[var(--muted-foreground)]">
                        <span>{mode === 'login' ? t('auth.switchToRegister.prompt') : t('auth.switchToLogin.prompt')} </span>
                        <button
                            type="button"
                            className="text-[var(--foreground)] underline underline-offset-2 hover:opacity-80"
                            onClick={() => {
                                setMode(prev => prev === 'login' ? 'register' : 'login');
                                setErrorKey(null);
                                setConfirmPassword('');
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
