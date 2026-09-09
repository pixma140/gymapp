import { databaseDirectory } from './databaseFiles.js';

const text = (env, key, fallback = '') => env[key]?.trim() || fallback;

function boolean(env, key, fallback = false) {
    const value = text(env, key);
    if (!value) return fallback;
    if (value !== 'true' && value !== 'false') throw new Error(`invalid_environment:${key}`);
    return value === 'true';
}

function url(env, key) {
    const value = text(env, key);
    if (!value) return '';
    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
        return value.replace(/\/$/, '');
    } catch {
        throw new Error(`invalid_environment:${key}`);
    }
}

export function readFixtureCredentials(env) {
    const credentials = {};
    for (const role of ['admin', 'user']) {
        const prefix = `SEED_${role.toUpperCase()}`;
        const username = text(env, `${prefix}_USERNAME`);
        const password = env[`${prefix}_PASSWORD`] || '';
        if (username.length < 3) throw new Error(`invalid_environment:${prefix}_USERNAME`);
        if (password.length < 8) throw new Error(`invalid_environment:${prefix}_PASSWORD`);
        credentials[role] = { username, password };
    }
    if (credentials.admin.username.toLowerCase() === credentials.user.username.toLowerCase()) {
        throw new Error('invalid_environment:SEED_USER_USERNAME');
    }
    return credentials;
}

// Explicit allowlists keep credentials and unrelated process environment out of APIs.
export function readServerConfig(env = {}) {
    const port = Number(text(env, 'PORT', '80'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_environment:PORT');
    const config = {
        port,
        dataDir: databaseDirectory(env),
        nodeEnv: text(env, 'NODE_ENV', 'development'),
        seedDevData: boolean(env, 'SEED_DEV_DATA'),
        cookieSecure: boolean(env, 'COOKIE_SECURE'),
        publicUrl: url(env, 'PUBLIC_URL'),
        viteApiTarget: url(env, 'VITE_API_TARGET'),
        adminUsername: text(env, 'ADMIN_USERNAME'),
        oidc: {
            clientId: text(env, 'OIDC_CLIENT_ID'),
            clientSecret: env.OIDC_CLIENT_SECRET || '',
        },
        environmentManaged: [],
    };
    if (text(env, 'OIDC_ENABLED')) config.oidc.enabled = boolean(env, 'OIDC_ENABLED');
    if (text(env, 'OIDC_ISSUER')) config.oidc.issuer = url(env, 'OIDC_ISSUER');
    if (text(env, 'OIDC_SCOPES')) config.oidc.scopes = text(env, 'OIDC_SCOPES');
    for (const [field, key] of Object.entries({
        port: 'PORT', dataDir: 'DATA_DIR', nodeEnv: 'NODE_ENV', seedDevData: 'SEED_DEV_DATA',
        cookieSecure: 'COOKIE_SECURE', publicUrl: 'PUBLIC_URL', viteApiTarget: 'VITE_API_TARGET',
    })) {
        if (text(env, key)) config.environmentManaged.push(field);
    }
    return config;
}

export function publicServerConfig(config) {
    const { port, dataDir, nodeEnv, seedDevData, cookieSecure, publicUrl, viteApiTarget, environmentManaged } = config;
    return { port, dataDir, nodeEnv, seedDevData, cookieSecure, publicUrl, viteApiTarget, environmentManaged };
}
