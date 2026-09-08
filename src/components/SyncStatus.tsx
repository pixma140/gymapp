import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase, useSession } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';

export function SyncStatus() {
    const db = useDatabase();
    const { refresh, drain } = useSession();
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const pending = useLiveQuery(() => db.outbox.toArray(), [db]);
    const metadata = useLiveQuery(() => db.syncMetadata.get('state'), [db]);
    const needsAttention = pending?.some(row => ['failed', 'conflict', 'paused'].includes(row.state));
    return <div className="mb-4 rounded-xl border border-[var(--border)] p-3 text-sm space-y-2" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
            <span>{t('sync.pending')}: {pending?.length ?? 0}</span>
            <button className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:opacity-50" disabled={busy} onClick={async () => {
                setBusy(true); setBlocked(false);
                try {
                    await drain();
                    if (await db.outbox.count()) { setBlocked(true); return; }
                    await refresh();
                } catch { setBlocked(true); } finally { setBusy(false); }
            }}>{t('sync.refresh')}</button>
        </div>
        {metadata && <p className="text-xs text-[var(--muted-foreground)]">{t('sync.lastRefreshed')}: {new Date(metadata.lastRefreshed).toLocaleString()}</p>}
        {needsAttention && <p role="alert">{t('sync.blocked')}</p>}
        {blocked && <p role="alert">{t('sync.refreshBlocked')}</p>}
    </div>;
}
