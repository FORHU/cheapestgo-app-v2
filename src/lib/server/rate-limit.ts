/**
 * Rate limiter — PostgreSQL-backed with in-memory fallback.
 *
 * Counters are stored in the rate_limit_counters table via the
 * increment_rate_limit RPC. This survives cold-starts and is shared
 * across all running instances.
 *
 * Falls back to a per-process Map when the DB is unreachable.
 *
 * Usage:
 *   const result = await rateLimit(req, { limit: 10, windowMs: 60_000 });
 *   if (!result.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

// ── In-memory fallback store ─────────────────────────────────────────────────
interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
let lastPurge = Date.now();

function maybePurge() {
    const now = Date.now();
    if (now - lastPurge < 5 * 60 * 1000) return;
    lastPurge = now;
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key);
    }
}

function inMemoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    maybePurge();
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { success: true, remaining: limit - 1, resetAt: now + windowMs };
    }
    entry.count += 1;
    return {
        success: entry.count <= limit,
        remaining: Math.max(0, limit - entry.count),
        resetAt: entry.resetAt,
    };
}

// ── PostgreSQL RPC helper ────────────────────────────────────────────────────
async function postgresRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const { getSqlAdmin } = await import('@/lib/db/postgres');
    const sql = getSqlAdmin();

    const rows = await sql`
        SELECT current_count, reset_at
        FROM increment_rate_limit(${key}, ${windowMs}::bigint)
    `;

    const row = rows[0];
    if (!row) throw new Error('increment_rate_limit returned no rows');

    const count: number = Number(row.current_count);
    const resetAt = new Date(row.reset_at).getTime();

    return {
        success: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
    };
}

// ── Public API ───────────────────────────────────────────────────────────────
export interface RateLimitOptions {
    limit: number;
    windowMs?: number;
    prefix?: string;
    /**
     * When provided the rate limit key is scoped to this user ID instead of IP.
     * Use for authenticated endpoints — prevents IP-spoofing bypasses and gives
     * per-user quotas which are more meaningful than per-IP on shared networks.
     */
    userId?: string;
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * Derive a stable client identifier for anonymous rate limiting.
 *
 * On Vercel the edge network sets `x-real-ip` to the true client IP and
 * clients cannot override it. We prefer this over `x-forwarded-for` where
 * the leftmost entry is the client-supplied value (spoofable).
 *
 * Fallback order: x-real-ip → rightmost x-forwarded-for → 'unknown'
 */
function getClientKey(req: Request): string {
    const headers = (req as any).headers;
    const get = (name: string): string => headers?.get?.(name) ?? '';

    // x-real-ip is set by Vercel's edge and is not forwardable by clients
    const realIp = get('x-real-ip').trim();
    if (realIp) return realIp;

    // Fallback: take the rightmost entry in x-forwarded-for.
    // Vercel appends the client IP, so the last entry is the most trustworthy.
    const forwarded = get('x-forwarded-for');
    if (forwarded) {
        const parts = forwarded.split(',');
        const last = parts[parts.length - 1]?.trim();
        if (last) return last;
    }

    return 'unknown';
}

export async function rateLimit(
    req: Request,
    options: RateLimitOptions,
): Promise<RateLimitResult> {
    const { limit, windowMs = 60_000, prefix = 'rl', userId } = options;
    // Authenticated routes key on user ID — immune to IP spoofing
    const clientId = userId ?? getClientKey(req);
    const key = `${prefix}:${clientId}`;

    if (process.env.DATABASE_URL) {
        try {
            return await postgresRateLimit(key, limit, windowMs);
        } catch (err) {
            console.warn('[rate-limit] Postgres unavailable, falling back to in-memory:', (err as Error).message);
        }
    }

    return inMemoryRateLimit(key, limit, windowMs);
}
