import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { MuscleGroup } from '@shared/exercises';
import { Modal } from '@/components/Modal';
import { MuscleGroupIllustration } from '@/components/MuscleGroupIllustration';
import { useLanguage } from '@/i18n/LanguageContext';
import { MUSCLE_GROUP_SECTIONS } from '@/lib/exerciseCatalog';
import { cn } from '@/lib/utils';

export function MuscleGroupPicker({ value, onChange }: {
    value: MuscleGroup | ''; onChange: (value: MuscleGroup | '') => void;
}) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const wasOpen = useRef(false);
    const id = useId();
    useEffect(() => {
        if (!open && wasOpen.current) trigger.current?.focus();
        wasOpen.current = open;
    }, [open]);
    const choose = (group: MuscleGroup | '') => {
        onChange(group);
        setOpen(false);
    };
    return <>
        <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium">
            {t(value ? `exercise.muscle.${value}` : 'exercise.allGroups')}
            <ChevronDown aria-hidden="true" className="size-4 text-[var(--muted-foreground)]" />
        </button>
        {open && <Modal title={t('exercise.muscles')} onClose={() => setOpen(false)} placement="bottom">
            <button type="button" aria-pressed={!value} onClick={() => choose('')}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 font-medium">
                {t('exercise.allGroups')}
                {!value && <Check aria-hidden="true" className="size-5 text-[var(--primary)]" />}
            </button>
            {MUSCLE_GROUP_SECTIONS.map(section => <section key={section.label} aria-labelledby={`${id}-${section.label}`}>
                <h3 id={`${id}-${section.label}`} className="border-b border-[var(--border)] py-3 text-sm font-semibold text-[var(--muted-foreground)]">{t(section.label)}</h3>
                <div className="grid grid-cols-3 gap-x-2 gap-y-4 py-4">
                    {section.groups.map(group => <button key={group} type="button" aria-pressed={value === group} onClick={() => choose(group)}
                        className={cn('flex min-w-0 flex-col items-center gap-2 rounded-xl p-1 text-center text-sm font-medium hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]',
                            value === group && 'bg-[var(--accent)] text-[var(--primary)]')}>
                        <span className="flex min-h-10 items-center justify-center">{t(`exercise.muscle.${group}`)}</span>
                        <span className={cn('flex aspect-square w-full max-w-24 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--card)]',
                            value === group && 'border-[var(--primary)]')}>
                            <MuscleGroupIllustration group={group} />
                        </span>
                    </button>)}
                </div>
            </section>)}
        </Modal>}
    </>;
}
