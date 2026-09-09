import { hashPassword } from './lib/crypto.js';

export const DEVELOPMENT_GYMS = Object.freeze([
    Object.freeze({ id: '84c9e7c0-a8e8-4b8f-9b3d-4cb0d2851eaa', name: 'Iron Odyssey', location: 'Foundry District' }),
    Object.freeze({ id: '2ee9ebf1-b9bd-48f2-aec5-c1891fb0101a', name: 'Moonshot Barbell Club', location: 'Riverside Hangar' }),
]);

// Only called by initializeSchema inside the fresh-install transaction.
export async function seedDevelopmentData(tx, credentials) {
    if (!credentials?.admin?.username || !credentials.admin.password || !credentials?.user?.username || !credentials.user.password) {
        throw new Error('fixture_credentials_required');
    }
    for (const [role, name, isAdmin] of [['admin', 'Administrator', 1], ['user', 'User', 0]]) {
        const { username, password } = credentials[role];
        await tx.runSql(`INSERT INTO users (username, passwordHash, name, isAdmin, language, theme, reminderFrequency, createdAt)
            VALUES (?, ?, ?, ?, 'en', 'dark', 'never', ?)`, [username, hashPassword(password), name, isAdmin, Date.now()]);
    }
    for (const gym of DEVELOPMENT_GYMS) {
        await tx.runSql('INSERT INTO gyms (id, name, location) VALUES (?, ?, ?)', [gym.id, gym.name, gym.location]);
    }
    await tx.runSql("INSERT INTO app_settings (key, value) VALUES ('dev.seed.completed', 'v1')");
}
