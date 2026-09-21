export const RATE_WINDOW_MS = 1000 * 60 * 15;

export function hasExactKeys(value, required, optional = []) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const allowed = new Set([...required, ...optional]);
    return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.has(key));
}

export function sendError(res, status, error) {
    res.status(status).json({ ok: false, error });
}

// Lightweight in-memory fixed-window rate limiter. Keyed by an arbitrary
// string (typically IP and/or username). Sufficient for a single-instance
// self-hosted deployment; swap for a shared store if scaled horizontally.
export function createRateLimiter() {
    const buckets = new Map();

    function allow(key, max, windowMs) {
        const now = Date.now();
        const bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }
        if (bucket.count >= max) return false;
        bucket.count += 1;
        return true;
    }

    // Periodically evict expired buckets so the map can't grow unbounded.
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets) {
            if (bucket.resetAt <= now) buckets.delete(key);
        }
    }, 1000 * 60 * 10).unref?.();

    return function enforceRateLimit(req, res, scope, max, windowMs, extraKey = '') {
        if (allow(`${scope}:${req.ip}:${extraKey}`, max, windowMs)) return true;
        sendError(res, 429, 'too_many_requests');
        return false;
    };
}
