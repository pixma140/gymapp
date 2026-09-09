import { useLanguage } from '@/i18n/LanguageContext';
import { MUSCLE_GROUP_SECTIONS } from '@/lib/exerciseCatalog';
import type { MuscleGroup } from '@shared/exercises';

export function MuscleGroupSelect({ value, onChange, allowAll = true }: {
    value: MuscleGroup | ''; onChange: (value: MuscleGroup | '') => void; allowAll?: boolean;
}) {
    const { t } = useLanguage();
    return <label className="block space-y-1">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">{t('exercise.muscleGroup')}</span>
        <select aria-label={t('exercise.muscleGroup')} className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-3" value={value}
            onChange={event => onChange(event.target.value as MuscleGroup | '')}>
            {allowAll && <option value="">{t('exercise.allGroups')}</option>}
            {!allowAll && <option value="" disabled>{t('exercise.chooseGroup')}</option>}
            {MUSCLE_GROUP_SECTIONS.map(section => <optgroup key={section.label} label={t(section.label)}>
                {section.groups.map(group => <option key={group} value={group}>{t(`exercise.muscle.${group}`)}</option>)}
            </optgroup>)}
        </select>
    </label>;
}
