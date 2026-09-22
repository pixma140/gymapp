import { v7 as uuidv7 } from 'uuid';
import { hashPassword } from './lib/crypto.js';

// Gym names/locations reused for every fixture account; each account gets its
// own rows with distinct generated ids.
export const DEVELOPMENT_GYMS = Object.freeze([
    Object.freeze({ name: 'Iron Odyssey', location: 'Foundry District' }),
    Object.freeze({ name: 'Moonshot Barbell Club', location: 'Riverside Hangar' }),
]);

// Only called by initializeSchema inside the fresh-install transaction.
export async function seedDevelopmentData(tx, credentials) {
    if (!credentials?.admin?.username || !credentials.admin.password || !credentials?.user?.username || !credentials.user.password) {
        throw new Error('fixture_credentials_required');
    }
    for (const [role, name, isAdmin] of [['admin', 'Administrator', 1], ['user', 'User', 0]]) {
        const { username, password } = credentials[role];
        const userId = uuidv7();
        await tx.runSql(`INSERT INTO users (id, username, passwordHash, name, isAdmin, language, theme, reminderFrequency, createdAt)
            VALUES (?, ?, ?, ?, ?, 'en', 'dark', 'never', ?)`, [userId, username, hashPassword(password), name, isAdmin, Date.now()]);
        for (const gym of DEVELOPMENT_GYMS) {
            await tx.runSql('INSERT INTO gyms (id, userId, name, location) VALUES (?, ?, ?, ?)', [uuidv7(), userId, gym.name, gym.location]);
        }
    }
    await tx.runSql("INSERT INTO app_settings (key, value) VALUES ('dev.seed.completed', 'v1')");
}
