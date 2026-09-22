import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { EXERCISE_TAXONOMY } from '@shared/exercises';
import type { Equipment } from '@shared/exercises';
import { Modal } from '@/components/Modal';
import { useLanguage } from '@/i18n/LanguageContext';
import { EQUIPMENT_KEYS } from '@/lib/exerciseCatalog';
import { cn } from '@/lib/utils';

export function EquipmentPicker({ value, onChange }: {
    value: Equipment | ''; onChange: (value: Equipment | '') => void;
}) {
    const { language, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const wasOpen = useRef(false);
    useEffect(() => {
        if (!open && wasOpen.current) trigger.current?.focus();
        wasOpen.current = open;
    }, [open]);
    const choose = (equipment: Equipment | '') => {
        onChange(equipment);
        setOpen(false);
    };
    const label = value ? EXERCISE_TAXONOMY.equipment[value][language] : t('exercise.allEquipment');
    return <>
        <span className="inline-flex min-h-12 min-w-0 items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-3 text-sm font-medium">
                <span className="truncate">{label}</span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-[var(--muted-foreground)]" />
            </button>
            {value && <button type="button" aria-label={t('exercise.clearEquipmentFilter')} onClick={() => onChange('')}
                className="grid place-items-center border-l border-[var(--border)] px-3 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
                <X aria-hidden="true" className="size-4" />
            </button>}
        </span>
        {open && <Modal title={t('exercise.equipment')} onClose={() => setOpen(false)} placement="bottom">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" aria-pressed={!value} onClick={() => choose('')}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 text-left font-medium">
                    {t('exercise.allEquipment')}
                    {!value && <Check aria-hidden="true" className="size-5 text-[var(--primary)]" />}
                </button>
                {EQUIPMENT_KEYS.map(equipment => <button key={equipment} type="button" aria-pressed={value === equipment}
                    onClick={() => choose(equipment)} className={cn('flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 text-left font-medium hover:bg-[var(--accent)]',
                        value === equipment && 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]')}>
                    {EXERCISE_TAXONOMY.equipment[equipment][language]}
                    {value === equipment && <Check aria-hidden="true" className="size-5" />}
                </button>)}
            </div>
        </Modal>}
    </>;
}
