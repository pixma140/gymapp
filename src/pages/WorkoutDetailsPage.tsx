import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '@/context/SessionContext';
import { applyOperation } from '@/db/operations';
import { useLanguage } from '@/i18n/LanguageContext';
export function WorkoutDetailsPage() {
    const { workoutId = '' } = useParams();
    const db = useDatabase();
    const { language, t } = useLanguage();
    const navigate = useNavigate();
    const [failed, setFailed] = useState(false);
    const workout = useLiveQuery(() => db.workouts.get(workoutId), [db, workoutId]);
    const gym = useLiveQuery(() => workout ? db.gyms.get(workout.gymId) : undefined, [db, workout]);
    return <div className="space-y-4 max-w-md mx-auto">
        <Link to="/analysis">{t('common.back')}</Link>
        <h1 className="text-2xl font-bold">{gym?.name ?? t('common.unknownGym')}</h1>
        {!workout ? <p>{t('timed.notFound')}</p> : <>
            <p>{new Date(workout.startTime).toLocaleString(language)}</p>
            <p>{workout.endTime === null ? t('timed.active') : new Date(workout.endTime).toLocaleString(language)}</p>
            {workout.endTime !== null && <p>{Math.floor((workout.endTime - workout.startTime) / 1000)} {t('timed.seconds')}</p>}
            <p>{t('timed.notice')}</p>
            <button className="p-3 text-red-500" onClick={async () => {
                if (!window.confirm(t('history.deleteConfirm'))) return;
                try { await applyOperation(db, 'workout.delete', workout.id, {}); navigate('/analysis'); } catch { setFailed(true); }
            }}>{t('history.delete')}</button>
            {failed && <p role="alert">{t('sync.operationFailed')}</p>}
        </>}
    </div>;
}
