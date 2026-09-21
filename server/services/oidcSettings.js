const OIDC_SETTING_KEY = 'oidc.config';
const EDITABLE_KEYS = ['enabled', 'issuer', 'scopes'];
const DISCOVERY_TTL_MS = 1000 * 60 * 60;

export const DEFAULT_OIDC_CONFIG = Object.freeze({
    enabled: false,
    issuer: '',
    scopes: 'openid profile email',
});

export function createOidcSettings(database, serverConfig) {
    const discoveryCache = new Map();

    async function getConfig() {
        const row = await database.getSql('SELECT value FROM app_settings WHERE key = ?', [OIDC_SETTING_KEY]);
        const stored = row?.value ? JSON.parse(row.value) : {};
        return { ...DEFAULT_OIDC_CONFIG, ...stored, ...serverConfig.oidc };
    }

    async function saveConfig(config) {
        const editable = Object.fromEntries(EDITABLE_KEYS
            .filter(key => !Object.hasOwn(serverConfig.oidc, key)).map(key => [key, config[key]]));
        await database.runSql(
            'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [OIDC_SETTING_KEY, JSON.stringify(editable)]
        );
        discoveryCache.clear();
    }

    function environmentManaged(key) {
        return Object.hasOwn(serverConfig.oidc, key);
    }

    function publicConfig(config) {
        return {
            enabled: config.enabled, issuer: config.issuer, scopes: config.scopes,
            hasCredentials: Boolean(config.clientId && config.clientSecret),
            environmentManaged: EDITABLE_KEYS.filter(environmentManaged),
        };
    }

    function isUsable(config) {
        return Boolean(config.enabled && config.issuer && config.clientId && config.clientSecret);
    }

    async function discover(issuer) {
        const normalizedIssuer = String(issuer ?? '').replace(/\/$/, '');
        if (!normalizedIssuer) throw new Error('missing_issuer');

        const cached = discoveryCache.get(normalizedIssuer);
        if (cached && cached.expiresAt > Date.now()) return cached.document;

        const response = await fetch(`${normalizedIssuer}/.well-known/openid-configuration`);
        if (!response.ok) throw new Error('discovery_failed');

        const document = await response.json();
        if (!document.authorization_endpoint || !document.token_endpoint || !document.jwks_uri || !document.issuer) {
            throw new Error('invalid_discovery_document');
        }

        discoveryCache.set(normalizedIssuer, { document, expiresAt: Date.now() + DISCOVERY_TTL_MS });
        return document;
    }

    function publicBaseUrl(req) {
        if (serverConfig.publicUrl) return serverConfig.publicUrl.replace(/\/$/, '');
        const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
        const proto = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');
        const host = req.headers['x-forwarded-host'] ?? req.headers.host;
        return `${proto}://${host}`;
    }

    function redirectUri(req) {
        return `${publicBaseUrl(req)}/api/auth/oidc/callback`;
    }

    return { getConfig, saveConfig, environmentManaged, publicConfig, isUsable, discover, redirectUri, editableKeys: EDITABLE_KEYS };
}
