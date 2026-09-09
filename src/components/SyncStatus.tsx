import { useState } from 'react';
import { Trash } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDatabase, useSession } from '@/context/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';

export function SyncStatus() {
    const db = useDatabase();
    const { refresh, drain, discardLocalChanges, resolveConflict } = useSession();
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const pending = useLiveQuery(() => db.outbox.toArray(), [db]);
    const metadata = useLiveQuery(() => db.syncMetadata.get('state'), [db]);
    const conflict = pending?.some(row => row.state === 'conflict');
    const failed = pending?.some(row => row.state === 'failed');
    const paused = pending?.some(row => row.state === 'paused');
    return <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm shadow-sm space-y-3" aria-live="polite">
        <div>
            <h2 className="font-semibold text-[var(--foreground)]">{t('sync.title')}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{t('sync.description')}</p>
        </div>
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
        {metadata && <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
            <p>{t('sync.lastSuccessful')}: {new Date(metadata.lastSuccessfulSync).toLocaleString()}</p>
            <p>{t('sync.lastRefreshed')}: {new Date(metadata.lastRefreshed).toLocaleString()}</p>
        </div>}
        {!conflict && !failed && !paused && !pending?.length && <p>{t('sync.statusCurrent')}</p>}
        {!conflict && !failed && !paused && Boolean(pending?.length) && <p>{t('sync.statusPending')}</p>}
        {paused && <p role="alert">{t('sync.statusPaused')}</p>}
        {failed && <p role="alert">{t('sync.statusFailed')}</p>}
        {failed && <details className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <summary className="cursor-pointer font-medium text-red-500">{t('sync.advancedRecovery')}</summary>
            <div className="mt-3 space-y-3">
                <p className="text-xs text-[var(--muted-foreground)]">{t('sync.discardDescription')}</p>
                <button
                    className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 font-medium text-red-500 disabled:opacity-50"
                    disabled={discarding}
                    onClick={async () => {
                        if (!confirm(t('sync.discardConfirm'))) return;
                        setDiscarding(true);
                        try { await discardLocalChanges(); } catch { setBlocked(true); }
                        finally { setDiscarding(false); }
                    }}
                >
                    <Trash className="size-4" />
                    {t('sync.discardAll')}
                </button>
            </div>
        </details>}
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
    </section>;
}
