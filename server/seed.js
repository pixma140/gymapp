import { v7 as uuidv7 } from 'uuid';
import { hashPassword } from './lib/crypto.js';

export const DEVELOPMENT_GYMS = Object.freeze([
    Object.freeze({ id: '01e086b6-4000-7b8f-9b3d-4cb0d2851eaa', name: 'Iron Odyssey', location: 'Foundry District' }),
    Object.freeze({ id: '01e086b6-4001-7ec5-8189-1fb0101a2ee9', name: 'Moonshot Barbell Club', location: 'Riverside Hangar' }),
]);

// Only called by initializeSchema inside the fresh-install transaction.
export async function seedDevelopmentData(tx, credentials) {
    if (!credentials?.admin?.username || !credentials.admin.password || !credentials?.user?.username || !credentials.user.password) {
        throw new Error('fixture_credentials_required');
    }
    for (const [role, name, isAdmin] of [['admin', 'Administrator', 1], ['user', 'User', 0]]) {
        const { username, password } = credentials[role];
        await tx.runSql(`INSERT INTO users (id, username, passwordHash, name, isAdmin, language, theme, reminderFrequency, createdAt)
            VALUES (?, ?, ?, ?, ?, 'en', 'dark', 'never', ?)`, [uuidv7(), username, hashPassword(password), name, isAdmin, Date.now()]);
    }
    for (const gym of DEVELOPMENT_GYMS) {
        await tx.runSql('INSERT INTO gyms (id, name, location) VALUES (?, ?, ?)', [gym.id, gym.name, gym.location]);
    }
    await tx.runSql("INSERT INTO app_settings (key, value) VALUES ('dev.seed.completed', 'v1')");
}
