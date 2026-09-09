import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export function Modal({ title, onClose, children, placement = 'center' }: {
    title: string; onClose: () => void; children: ReactNode; placement?: 'center' | 'bottom';
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const { t } = useLanguage();
    useEffect(() => {
        const dialog = ref.current!;
        dialog.showModal();
        dialog.querySelector<HTMLInputElement>('input')?.focus();
        return () => dialog.close();
    }, []);
    return <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
        className={cn('fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--background)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm',
            placement === 'bottom' && 'mt-auto mb-0 w-full rounded-b-none backdrop:bg-black/50 backdrop:backdrop-blur-none')}
    >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] p-4">
            <h2 id={titleId} className="font-bold">{title}</h2>
            <button type="button" aria-label={t('common.close')} onClick={onClose} className="rounded-lg p-2 text-[var(--muted-foreground)]"><X className="size-5" /></button>
        </header>
        <div className="space-y-4 p-4">{children}</div>
    </dialog>;
}
