import { v7 as uuidv7 } from 'uuid';
import { hashPassword } from '../lib/crypto.js';

export function createAccountService(database) {
    const insertPasswordAccount = async (tx, profile, isAdmin = false) => {
        const id = uuidv7();
        await tx.runSql(
            'INSERT INTO users (id, username, passwordHash, name, email, isAdmin, language, theme, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, profile.username, hashPassword(profile.password), profile.name ?? profile.username, profile.email ?? null,
                isAdmin ? 1 : 0, profile.language ?? 'en', 'dark', Date.now()]
        );
        return { id };
    };
    return {
        setup: profile => database.transaction(async tx => {
            const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users');
            if (count > 0) return { status: 409, error: 'already_setup' };
            return insertPasswordAccount(tx, profile, true);
        }),
        create: (profile, actorId = null) => database.transaction(async tx => {
            if (actorId !== null) {
                const guard = await requireAdmin(tx, actorId);
                if (guard) return guard;
            } else {
                const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users');
                if (!count) return { status: 409, error: 'setup_required' };
            }
            const existing = await tx.getSql('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [profile.username]);
            if (existing) return { status: 409, error: 'username_taken' };
            return insertPasswordAccount(tx, profile, actorId !== null && profile.isAdmin === true);
        }),
        resolveOidc: profile => database.transaction(async tx => {
            const existing = await tx.getSql('SELECT id FROM users WHERE oidcIssuer = ? AND oidcSubject = ?', [profile.issuer, profile.subject]);
            if (existing) return existing;
            const id = uuidv7();
            await tx.runSql(
                'INSERT INTO users (id, name, email, oidcIssuer, oidcSubject, language, theme, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [id, profile.name, profile.email, profile.issuer, profile.subject, 'en', 'dark', Date.now()]
            );
            return { id };
        }),
        resetPassword: (actorId, targetId, password) => database.transaction(async tx => {
            const guard = await requireAdmin(tx, actorId);
            if (guard) return guard;
            const target = await tx.getSql('SELECT username FROM users WHERE id = ?', [targetId]);
            if (!target) return { status: 404, error: 'user_not_found' };
            if (!target.username) return { status: 400, error: 'no_password_auth' };
            await tx.runSql('UPDATE users SET passwordHash = ? WHERE id = ?', [hashPassword(password), targetId]);
            await tx.runSql('DELETE FROM sessions WHERE userId = ?', [targetId]);
            return { ok: true };
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
    const guard = await requireAdmin(tx, actorId);
    if (guard) return guard;
    if (selfError && actorId === targetId) return { status: 400, error: selfError };
    const target = await tx.getSql('SELECT isAdmin FROM users WHERE id = ?', [targetId]);
    if (!target) return { status: 404, error: 'user_not_found' };
    if (selfError && target.isAdmin) {
        const { count } = await tx.getSql('SELECT COUNT(*) AS count FROM users WHERE isAdmin = 1');
        if (count <= 1) return { status: 400, error: 'last_admin' };
    }
    return null;
}

async function requireAdmin(tx, actorId) {
    const actor = await tx.getSql('SELECT isAdmin FROM users WHERE id = ?', [actorId]);
    return actor?.isAdmin ? null : { status: 403, error: 'forbidden' };
}
