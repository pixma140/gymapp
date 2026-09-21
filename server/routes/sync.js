import { Router } from 'express';
import { sendError } from '../lib/http.js';

export function createSyncRoutes({ sessions, sync }) {
    const router = Router();
    router.get('/api/sync/generations', async (req, res) => {
        const user = await sessions.requireUser(req, res);
        if (!user) return;
        try {
            const result = await sync.generations(user.id);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('generations_failed', error);
            sendError(res, 500, 'generations_failed');
        }
    });

    router.post('/api/sync', async (req, res) => {
        const user = await sessions.requireUser(req, res);
        if (!user) return;
        try {
            const result = await sync.apply(user.id, req.body);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('sync_failed', error);
            sendError(res, 500, 'sync_failed');
        }
    });

    router.get('/api/sync/snapshot', async (req, res) => {
        const user = await sessions.requireUser(req, res);
        if (!user) return;
        try {
            const result = await sync.snapshot(user.id);
            if (result.error) return sendError(res, result.status, result.error);
            res.json({ ok: true, ...result });
        } catch (error) {
            console.error('snapshot_failed', error);
            sendError(res, 500, 'snapshot_failed');
        }
    });

    return router;
}
