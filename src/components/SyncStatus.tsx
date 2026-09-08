import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase, useSession } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';

export function SyncStatus() {
    const db = useDatabase();
    const { refresh, drain, resolveConflict } = useSession();
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const pending = useLiveQuery(() => db.outbox.toArray(), [db]);
    const metadata = useLiveQuery(() => db.syncMetadata.get('state'), [db]);
    const conflict = pending?.some(row => row.state === 'conflict');
    const failed = pending?.some(row => row.state === 'failed');
    const paused = pending?.some(row => row.state === 'paused');
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
        {!conflict && !failed && !paused && Boolean(pending?.length) && <p>{t('sync.statusPending')}</p>}
        {paused && <p role="alert">{t('sync.statusPaused')}</p>}
        {failed && <p role="alert">{t('sync.statusFailed')}</p>}
        {conflict && <div className="space-y-2" role="alert">
            <p>{t('sync.statusConflict')}</p>
            <details>
                <summary className="cursor-pointer">{t('sync.review')}</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-[var(--accent)] p-2 text-xs">{JSON.stringify(
                    pending?.map(entry => ({ operation: entry.intent.operation, targetId: entry.intent.targetId, payload: entry.intent.payload })), null, 2,
                )}</pre>
            </details>
            <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:opacity-50" disabled={busy} onClick={async () => {
                    if (!confirm(t('sync.conflictDiscardConfirm'))) return;
                    setBusy(true);
                    try { await resolveConflict('discard'); } catch { setBlocked(true); } finally { setBusy(false); }
                }}>{t('sync.conflictDiscard')}</button>
                <button className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:opacity-50" disabled={busy} onClick={async () => {
                    if (!confirm(t('sync.conflictReapplyConfirm'))) return;
                    setBusy(true);
                    try { await resolveConflict('reapply'); } catch { setBlocked(true); } finally { setBusy(false); }
                }}>{t('sync.conflictReapply')}</button>
            </div>
        </div>}
        {blocked && <p role="alert">{t('sync.refreshBlocked')}</p>}
    </div>;
}
