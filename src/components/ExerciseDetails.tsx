import { EXERCISE_SOURCE, EXERCISE_TAXONOMY } from '@shared/exercises';
import type { ExerciseLocale } from '@shared/exercises';
import type { DisplayExercise } from '@/lib/exerciseCatalog';
import { useLanguage } from '@/i18n/LanguageContext';

export function ExerciseDetails({ exercise, locale }: { exercise: DisplayExercise; locale: ExerciseLocale }) {
    const { t } = useLanguage();
    const catalog = exercise.catalog;
    if (!catalog) return <p className="text-sm text-[var(--muted-foreground)]">{t('exercise.detailsUnavailable')}</p>;
    const secondary = catalog.secondaryMuscles.map(key => EXERCISE_TAXONOMY.muscles[key][locale]);
    return <div className="space-y-5">
        {catalog.media.gif ? <div className="overflow-hidden rounded-xl bg-black/10">
            <img src={catalog.media.gif} alt={exercise.name} className="mx-auto aspect-square w-full max-w-sm object-contain" />
        </div> : <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
            {t('exercise.mediaUnavailable')}
        </div>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--muted-foreground)]">{t('exercise.equipment')}</dt>
            <dd>{EXERCISE_TAXONOMY.equipment[catalog.equipment][locale]}</dd>
            <dt className="text-[var(--muted-foreground)]">{t('exercise.bodyPart')}</dt>
            <dd>{EXERCISE_TAXONOMY.bodyParts[catalog.bodyPart][locale]}</dd>
            <dt className="text-[var(--muted-foreground)]">{t('exercise.target')}</dt>
            <dd>{EXERCISE_TAXONOMY.muscles[catalog.target][locale]}</dd>
            {secondary.length > 0 && <>
                <dt className="text-[var(--muted-foreground)]">{t('exercise.secondaryMuscles')}</dt>
                <dd>{secondary.join(', ')}</dd>
            </>}
        </dl>
        <section>
            <h3 className="mb-2 font-semibold">{t('exercise.instructions')}</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--muted-foreground)]">
                {catalog.instructions[locale].map((step, index) => <li key={index}>{step}</li>)}
            </ol>
        </section>
        {catalog.media.gif && <p className="text-xs text-[var(--muted-foreground)]">
            {t('exercise.mediaAttribution')} <a className="underline" href={EXERCISE_SOURCE.mediaAttribution.url} target="_blank" rel="noreferrer">{EXERCISE_SOURCE.mediaAttribution.label}</a>
        </p>}
    </div>;
}
