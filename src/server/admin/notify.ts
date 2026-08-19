import { getSqlAdmin } from '@/server/db/postgres';

type NotificationType = 'booking' | 'system' | 'alert';

export function createNotification(title: string, description: string, type: NotificationType = 'booking'): void {
    try {
        const sql = getSqlAdmin();
        Promise.resolve(
            sql`INSERT INTO notifications (title, description, type, read) VALUES (${title}, ${description}, ${type}, false)`,
        ).catch(e => console.error('[notify] Insert failed:', e?.message));
    } catch {}
}

export function logAdminAction(params: {
    action: string; bookingId?: string; sessionId?: string; table?: string;
    previousStatus?: string; newStatus?: string; provider?: string; details?: string; triggeredBy?: string;
}): void {
    try { console.log(JSON.stringify({ _event: 'admin_audit', ...params, timestamp: new Date().toISOString() })); } catch {}
}
