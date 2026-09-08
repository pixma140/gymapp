import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { getOidcAdminConfig, saveOidcAdminConfig } from '@/auth/admin';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';

export function OidcSettingsTab() {
    const { t } = useLanguage();

    const [enabled, setEnabled] = useState(false);
    const [issuer, setIssuer] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [scopes, setScopes] = useState('openid profile email');
    const [hasClientSecret, setHasClientSecret] = useState(false);
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
                setClientId(result.config.clientId);
                setScopes(result.config.scopes || 'openid profile email');
                setHasClientSecret(result.config.hasClientSecret);
                setRedirectUri(result.redirectUri ?? '');
            }

            setIsLoading(false);
        });

        return () => {
            mounted = false;
        };
    }, []);

    const errorKeyForCode = (code?: string): TranslationKey => {
        if (code === 'missing_required_fields') return 'admin.oidc.error.required';
        if (code === 'discovery_failed') return 'admin.oidc.error.discovery';
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
                clientId: clientId.trim(),
                clientSecret: clientSecret.length > 0 ? clientSecret : undefined,
                scopes: scopes.trim()
            });

            if (!result.ok || !result.config) {
                setErrorKey(errorKeyForCode(result.error));
                return;
            }

            setEnabled(result.config.enabled);
            setIssuer(result.config.issuer);
            setClientId(result.config.clientId);
            setScopes(result.config.scopes || 'openid profile email');
            setHasClientSecret(result.config.hasClientSecret);
            setRedirectUri(result.redirectUri ?? redirectUri);
            setClientSecret('');
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
    const inputClass = 'w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors';

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
                    </span>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) => setEnabled(event.target.checked)}
                        className="size-5 accent-[var(--primary)]"
                    />
                </label>
            </div>

            <div>
                <label className={labelClass}>{t('admin.oidc.issuer')}</label>
                <input
                    type="url"
                    value={issuer}
                    onChange={(event) => setIssuer(event.target.value)}
                    placeholder={t('admin.oidc.issuer.placeholder')}
                    className={inputClass}
                />
            </div>

            <div>
                <label className={labelClass}>{t('admin.oidc.clientId')}</label>
                <input
                    type="text"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className={inputClass}
                    autoComplete="off"
                />
            </div>

            <div>
                <label className={labelClass}>{t('admin.oidc.clientSecret')}</label>
                <input
                    type="password"
                    value={clientSecret}
                    onChange={(event) => setClientSecret(event.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    placeholder={hasClientSecret ? '••••••••' : ''}
                />
                {hasClientSecret && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{t('admin.oidc.clientSecret.set')}</p>
                )}
            </div>

            <div>
                <label className={labelClass}>{t('admin.oidc.scopes')}</label>
                <input
                    type="text"
                    value={scopes}
                    onChange={(event) => setScopes(event.target.value)}
                    className={inputClass}
                    autoComplete="off"
                />
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
                disabled={isSaving}
                className="w-full bg-[var(--primary)] disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
            >
                {isSaving ? t('admin.oidc.saving') : t('admin.oidc.save')}
            </button>
        </form>
    );
}
