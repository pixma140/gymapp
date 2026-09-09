import { useState } from 'react';
import type { Workout } from '@shared/commands';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatLocalDateTime } from '@/lib/workoutDisplay';

export function WorkoutTimeEditor({ workout, onSaved }: { workout: Workout; onSaved: () => void }) {
    const db = useDatabase();
    const { t } = useLanguage();
    const [start, setStart] = useState<string | null>(null);
    const [end, setEnd] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [invalid, setInvalid] = useState(false);
    return <form id="workout-times" className="space-y-3 rounded-2xl border border-[var(--border)] p-4" onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        const startTime = start === null ? workout.startTime : new Date(start).getTime();
        const endTime = workout.endTime === null ? undefined : end === null ? workout.endTime : new Date(end).getTime();
        if (!Number.isSafeInteger(startTime) || startTime < 0
            || (endTime !== undefined && (!Number.isSafeInteger(endTime) || endTime < startTime))) {
            setInvalid(true); return;
        }
        setInvalid(false); setFailed(false); setBusy(true);
        try {
            if (startTime !== workout.startTime || (endTime !== undefined && endTime !== workout.endTime)) {
                await applyOperation(db, 'workout.update', workout.id, { startTime, ...(endTime === undefined ? {} : { endTime }) });
            }
            onSaved();
        } catch { setFailed(true); } finally { setBusy(false); }
    }}>
        <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1">
                <span className="text-xs text-[var(--muted-foreground)]">{t('workout.startTime')}</span>
                <input type="datetime-local" required value={start ?? formatLocalDateTime(workout.startTime)}
                    onChange={event => { setStart(event.target.value); setInvalid(false); }}
                    className="block w-full min-w-0 rounded-lg bg-[var(--accent)] p-3" />
            </label>
            {workout.endTime !== null && <label className="min-w-0 space-y-1">
                <span className="text-xs text-[var(--muted-foreground)]">{t('workout.endTime')}</span>
                <input type="datetime-local" required value={end ?? formatLocalDateTime(workout.endTime)}
                    onChange={event => { setEnd(event.target.value); setInvalid(false); }}
                    className="block w-full min-w-0 rounded-lg bg-[var(--accent)] p-3" />
            </label>}
        </fieldset>
        {invalid && <p role="alert" className="text-sm text-red-500">{t('workout.invalidTimes')}</p>}
        {failed && <p role="alert" className="text-sm text-red-500">{t('sync.operationFailed')}</p>}
    </form>;
}
