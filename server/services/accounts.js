import { hashPassword } from '../lib/crypto.js';

export function createAccountService(database) {
    return {
        setup: profile => database.transaction(async tx => {
            const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users');
            if (count > 0) return { status: 409, error: 'already_setup' };
            const result = await tx.runSql(
                'INSERT INTO users (username, passwordHash, name, email, isAdmin, language, theme, createdAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
                [profile.username, hashPassword(profile.password), profile.name, profile.email, profile.language, 'dark', Date.now()]
            );
            return { id: result.lastID };
        }),
        changeRole: (actorId, targetId, isAdmin) => database.transaction(async tx => {
            const guard = await checkAdminChange(tx, actorId, targetId, isAdmin ? null : 'cannot_demote_self');
            if (guard) return guard;
            await tx.runSql('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin ? 1 : 0, targetId]);
            return { ok: true };
        }),
        delete: (actorId, targetId) => database.transaction(async tx => {
            const guard = await checkAdminChange(tx, actorId, targetId, 'cannot_delete_self');
            if (guard) return guard;
            await tx.runSql('DELETE FROM users WHERE id = ?', [targetId]);
            return { ok: true };
        }),
    };
}

async function checkAdminChange(tx, actorId, targetId, selfError) {
    const actor = await tx.getSql('SELECT isAdmin FROM users WHERE id = ?', [actorId]);
    if (!actor?.isAdmin) return { status: 403, error: 'forbidden' };
    if (selfError && actorId === targetId) return { status: 400, error: selfError };
    const target = await tx.getSql('SELECT isAdmin FROM users WHERE id = ?', [targetId]);
    if (!target) return { status: 404, error: 'user_not_found' };
    if (selfError && target.isAdmin) {
        const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users WHERE isAdmin = 1');
        if (count <= 1) return { status: 400, error: 'last_admin' };
    }
    return null;
}
