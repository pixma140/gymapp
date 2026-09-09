import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { getOidcAdminConfig, saveOidcAdminConfig, type OidcAdminConfig } from '@/auth/admin';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

export function OidcSettingsTab() {
    const { t } = useLanguage();

    const [enabled, setEnabled] = useState(false);
    const [issuer, setIssuer] = useState('');
    const [scopes, setScopes] = useState('openid profile email');
    const [hasCredentials, setHasCredentials] = useState(false);
    const [environmentManaged, setEnvironmentManaged] = useState<OidcAdminConfig['environmentManaged']>([]);
    const [redirectUri, setRedirectUri] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState(false);
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let mounted = true;

        void getOidcAdminConfig().then((result) => {
            if (!mounted) {
                return;
            }

            if (result.ok && result.config) {
                setEnabled(result.config.enabled);
                setIssuer(result.config.issuer);
                setScopes(result.config.scopes || 'openid profile email');
                setHasCredentials(result.config.hasCredentials);
                setEnvironmentManaged(result.config.environmentManaged);
                setRedirectUri(result.redirectUri ?? '');
            } else {
                setErrorKey('admin.config.error');
            }

            setIsLoading(false);
        }).catch(() => {
            if (mounted) { setErrorKey('admin.config.error'); setIsLoading(false); }
        });

        return () => {
            mounted = false;
        };
    }, []);

    const errorKeyForCode = (code?: string): TranslationKey => {
        if (code === 'missing_required_fields') return 'admin.oidc.error.required';
        if (code === 'discovery_failed') return 'admin.oidc.error.discovery';
        if (code === 'environment_managed') return 'admin.config.managed';
        return 'admin.oidc.error.generic';
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setErrorKey(null);
        setSavedMessage(false);
        setIsSaving(true);

        try {
            const result = await saveOidcAdminConfig({
                enabled,
                issuer: issuer.trim(),
                scopes: scopes.trim()
            });

            if (!result.ok || !result.config) {
                setErrorKey(errorKeyForCode(result.error));
                return;
            }

            setEnabled(result.config.enabled);
            setIssuer(result.config.issuer);
            setScopes(result.config.scopes || 'openid profile email');
            setHasCredentials(result.config.hasCredentials);
            setEnvironmentManaged(result.config.environmentManaged);
            setRedirectUri(result.redirectUri ?? redirectUri);
            setSavedMessage(true);
        } catch {
            setErrorKey('admin.oidc.error.generic');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(redirectUri);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard not available; ignore
        }
    };

    if (isLoading) {
        return <div className="text-sm text-[var(--muted-foreground)] py-8 text-center">{t('common.loading')}</div>;
    }

    const labelClass = 'block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2';
    const inputClass = 'w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-60';

    return (
        <form onSubmit={handleSave} className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('admin.oidc.title')}</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">{t('admin.oidc.desc')}</p>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span>
                        <span className="block text-sm font-medium text-[var(--foreground)]">{t('admin.oidc.enabled')}</span>
                        <span className="block text-xs text-[var(--muted-foreground)]">{t('admin.oidc.enabled.desc')}</span>
                        {environmentManaged.includes('enabled') && <span className="block text-xs text-[var(--muted-foreground)]">{t('admin.config.managed')}</span>}
                    </span>
                    <input
                        type="checkbox"
                        checked={enabled}
                        disabled={environmentManaged.includes('enabled')}
                        onChange={(event) => setEnabled(event.target.checked)}
                        className="size-5 accent-[var(--primary)]"
                    />
                </label>
            </div>

            <div>
                <label htmlFor="oidc-issuer" className={labelClass}>{t('admin.oidc.issuer')}</label>
                <input
                    id="oidc-issuer"
                    type="url"
                    value={issuer}
                    disabled={environmentManaged.includes('issuer')}
                    onChange={(event) => setIssuer(event.target.value)}
                    placeholder={t('admin.oidc.issuer.placeholder')}
                    className={inputClass}
                />
                {environmentManaged.includes('issuer') && <p className="text-xs text-[var(--muted-foreground)] mt-1">{t('admin.config.managed')}</p>}
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                <p className="text-sm text-[var(--foreground)]">{t(hasCredentials ? 'admin.oidc.credentials.set' : 'admin.oidc.credentials.missing')}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">{t('admin.oidc.credentials.desc')}</p>
            </div>

            <div>
                <label htmlFor="oidc-scopes" className={labelClass}>{t('admin.oidc.scopes')}</label>
                <input
                    id="oidc-scopes"
                    type="text"
                    value={scopes}
                    disabled={environmentManaged.includes('scopes')}
                    onChange={(event) => setScopes(event.target.value)}
                    className={inputClass}
                    autoComplete="off"
                />
                {environmentManaged.includes('scopes') && <p className="text-xs text-[var(--muted-foreground)] mt-1">{t('admin.config.managed')}</p>}
            </div>

            {redirectUri && (
                <div>
                    <label className={labelClass}>{t('admin.oidc.redirectUri')}</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--foreground)] break-all">
                            {redirectUri}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="shrink-0 border border-[var(--border)] bg-[var(--input)] hover:bg-[var(--accent)] rounded-xl p-3 transition-colors"
                            title={copied ? t('admin.oidc.copied') : t('admin.oidc.copy')}
                        >
                            {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-[var(--muted-foreground)]" />}
                        </button>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{t('admin.oidc.redirectUri.desc')}</p>
                </div>
            )}

            {errorKey && <p className="text-sm text-red-500">{t(errorKey)}</p>}
            {savedMessage && <p className="text-sm text-green-500">{t('admin.oidc.saved')}</p>}

            <button
                type="submit"
                disabled={isSaving || environmentManaged.length === 3}
                className="w-full bg-[var(--primary)] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
            >
                {isSaving ? t('admin.oidc.saving') : t('admin.oidc.save')}
            </button>
        </form>
    );
}
