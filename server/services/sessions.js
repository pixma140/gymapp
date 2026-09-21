import crypto from 'node:crypto';
import { parseCookies } from '../lib/crypto.js';
import { sendError } from '../lib/http.js';

const SESSION_COOKIE = 'gymapp_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const USER_COLUMNS = 'id, username, name, language, theme, isAdmin';

export function createSessionService(database, { cookieSecure }) {
    function setSessionCookie(res, sessionId) {
        const secure = cookieSecure ? '; Secure' : '';
        const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`);
    }

    function clearSessionCookie(res) {
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    }

    function sessionIdFrom(req) {
        return parseCookies(req.headers.cookie)[SESSION_COOKIE];
    }

    async function createSession(userId, res) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + SESSION_TTL_MS;
        await database.runSql('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)', [sessionId, userId, expiresAt]);
        await database.runSql('UPDATE users SET lastLoginAt = ? WHERE id = ?', [Date.now(), userId]).catch(() => {});
        setSessionCookie(res, sessionId);
    }

    async function destroySession(req, res) {
        const sessionId = sessionIdFrom(req);
        if (sessionId) await database.runSql('DELETE FROM sessions WHERE id = ?', [sessionId]);
        clearSessionCookie(res);
    }

    async function resolveSessionUser(req, sql = database) {
        const sessionId = sessionIdFrom(req);
        if (!sessionId) return null;
        const row = await sql.getSql(
            'SELECT users.id, users.username, users.name, users.language, users.theme, users.isAdmin FROM sessions JOIN users ON users.id = sessions.userId WHERE sessions.id = ? AND sessions.expiresAt > ?',
            [sessionId, Date.now()]
        );
        if (!row) {
            await sql.runSql('DELETE FROM sessions WHERE id = ?', [sessionId]).catch(() => {});
            return null;
        }
        return { ...row, isAdmin: Boolean(row.isAdmin) };
    }

    async function readUser(userId) {
        const user = await database.getSql(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [userId]);
        return { ...user, isAdmin: Boolean(user?.isAdmin) };
    }

    async function requireUser(req, res) {
        const user = await resolveSessionUser(req);
        if (!user) {
            sendError(res, 401, 'unauthorized');
            return null;
        }
        return user;
    }

    async function requireAdmin(req, res) {
        const user = await requireUser(req, res);
        if (!user) return null;
        if (!user.isAdmin) {
            sendError(res, 403, 'forbidden');
            return null;
        }
        return user;
    }

    return { createSession, destroySession, resolveSessionUser, readUser, requireUser, requireAdmin };
}
