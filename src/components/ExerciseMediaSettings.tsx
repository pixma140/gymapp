import { useEffect, useSyncExternalStore } from 'react';
import { Image, RefreshCw, Trash2 } from 'lucide-react';
import { EXERCISE_SOURCE } from '@shared/exercises';
import { cacheExerciseMedia, clearExerciseMediaCache, getExerciseMediaCacheStatus,
    refreshExerciseMediaCacheStatus, subscribeExerciseMediaCache } from '@/lib/exerciseMediaCache';
import { useLanguage } from '@/i18n/LanguageContext';

export function ExerciseMediaSettings() {
    const { t, language } = useLanguage();
    const status = useSyncExternalStore(subscribeExerciseMediaCache, getExerciseMediaCacheStatus, getExerciseMediaCacheStatus);
    useEffect(() => { void refreshExerciseMediaCacheStatus(); }, []);
    const percent = status.total ? Math.round(status.cached / status.total * 100) : 100;
    const size = new Intl.NumberFormat(language, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
        .format(status.bytes / 1024 / 1024);
    return <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="flex items-start gap-3">
            <Image className="mt-0.5 size-5 shrink-0 text-[var(--muted-foreground)]" />
            <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{t('settings.exerciseMedia')}</h3>
                <p className="text-xs text-[var(--muted-foreground)]">{t(`settings.exerciseMedia.${status.state}`)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent)]">
                    <div className="h-full bg-[var(--primary)] transition-[width]" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {status.cached.toLocaleString(language)} / {status.total.toLocaleString(language)} · {size}
                    {status.failed > 0 && ` · ${status.failed.toLocaleString(language)} ${t('settings.exerciseMedia.failedCount')}`}
                </p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {t('exercise.mediaAttribution')} <a className="underline" href={EXERCISE_SOURCE.mediaAttribution.url} target="_blank" rel="noreferrer">{EXERCISE_SOURCE.mediaAttribution.label}</a>
                </p>
            </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
            <button type="button" disabled={status.state === 'downloading'} onClick={() => void clearExerciseMediaCache()}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50">
                <Trash2 className="size-3" />{t('settings.exerciseMedia.clear')}
            </button>
            <button type="button" disabled={status.state === 'downloading'} onClick={() => void cacheExerciseMedia()}
                className="flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs text-white disabled:opacity-50">
                <RefreshCw className="size-3" />{t('settings.exerciseMedia.retry')}
            </button>
        </div>
    </div>;
}
