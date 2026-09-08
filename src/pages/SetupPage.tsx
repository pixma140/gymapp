import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { setupInitialAdmin } from '@/auth/session';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSession } from '@/context/SessionContext';
import type { Language, TranslationKey } from '@/i18n/translations';

export function SetupPage() {
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();
    const { status, refresh } = useSession();

    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorKey(null);

        if (password !== confirmPassword) {
            setErrorKey('setup.error.passwordMismatch');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await setupInitialAdmin({
                username: username.trim(),
                password,
                name: name.trim() || username.trim(),
                email: email.trim() || undefined,
                language
            });

            if (!result.ok || !result.user) {
                setErrorKey(result.error === 'already_setup' ? 'setup.error.alreadyDone' : 'setup.error.generic');
                return;
            }

            await refresh();

            navigate('/onboarding', { replace: true });
        } catch {
            setErrorKey('setup.error.generic');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (status === 'failed') return <div className="p-6"><p>{t('sync.loadFailed')}</p><button onClick={() => void refresh()}>{t('sync.retry')}</button></div>;
    if (status === 'loading' || status === 'preparing') return <p>{t('common.loading')}</p>;
    if (status !== 'setup') return <Navigate to={status === 'ready' ? '/' : '/auth'} replace />;

    const labelClass = 'text-xs uppercase tracking-wider text-[var(--muted-foreground)]';
    const inputClass = 'w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]';

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col p-6">
            <div className="w-full max-w-md mx-auto flex justify-end mb-4">
                <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as Language)}
                    className="bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs p-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                    aria-label={t('settings.language')}
                >
                    <option value="en">{t('language.english')}</option>
                    <option value="de">{t('language.german')}</option>
                </select>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <form onSubmit={handleSubmit} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-5 shadow-xl">
                    <div className="space-y-3 text-center">
                        <div className="size-14 bg-[var(--primary)]/20 text-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto ring-1 ring-[var(--primary)]/50">
                            <ShieldCheck className="size-7" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">{t('setup.title')}</h1>
                        <p className="text-sm text-[var(--muted-foreground)]">{t('setup.subtitle')}</p>
                    </div>

                    <div className="space-y-2">
                        <label className={labelClass}>{t('setup.username')}</label>
                        <input
                            required
                            minLength={3}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className={inputClass}
                            autoComplete="username"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelClass}>{t('setup.name')}</label>
                        <input
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={inputClass}
                            autoComplete="name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelClass}>{t('setup.email')} <span className="normal-case text-[var(--muted-foreground)]">({t('common.optional')})</span></label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className={inputClass}
                            autoComplete="email"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelClass}>{t('setup.password')}</label>
                        <input
                            required
                            minLength={8}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className={inputClass}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={labelClass}>{t('setup.confirmPassword')}</label>
                        <input
                            required
                            minLength={8}
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className={inputClass}
                            autoComplete="new-password"
                        />
                    </div>

                    {errorKey && <p className="text-sm text-red-500">{t(errorKey)}</p>}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[var(--primary)] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
                    >
                        {isSubmitting ? t('auth.submitting') : t('setup.submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}
