import { HeartPulse } from 'lucide-react';
import type { MuscleGroup } from '@shared/exercises';

// Original schematic illustrations; each highlighted region matches the filter.
const REGIONS: Record<Exclude<MuscleGroup, 'cardio'>, string> = {
    chest: 'M35 33 Q43 29 49 34 L48 45 Q38 48 34 41Z M65 33 Q57 29 51 34 L52 45 Q62 48 66 41Z',
    shoulders: 'M34 31 Q24 31 23 43 L31 45 L36 34Z M66 31 Q76 31 77 43 L69 45 L64 34Z',
    traps: 'M43 24 L36 32 L47 44 L50 49 L53 44 L64 32 L57 24 L55 31 L45 31Z',
    lats: 'M34 39 L46 46 L48 61 L39 56Z M66 39 L54 46 L52 61 L61 56Z',
    middleBack: 'M42 36 L49 33 L49 57 L43 50Z M58 36 L51 33 L51 57 L57 50Z',
    lowerBack: 'M42 54 L49 58 L51 58 L58 54 L60 65 L51 69 L49 69 L40 65Z',
    biceps: 'M25 43 L32 45 L29 57 L23 56Z M75 43 L68 45 L71 57 L77 56Z',
    triceps: 'M24 42 L32 44 L30 57 L22 56Z M76 42 L68 44 L70 57 L78 56Z',
    forearms: 'M22 57 L29 59 L24 73 L18 72Z M78 57 L71 59 L76 73 L82 72Z',
    abs: 'M44 47 L49 48 L49 54 L43 54Z M51 48 L56 47 L57 54 L51 54Z M43 56 L49 56 L49 62 L44 62Z M51 56 L57 56 L56 62 L51 62Z M44 64 L49 64 L49 70 L46 68Z M51 64 L56 64 L54 68 L51 70Z',
    quadriceps: 'M36 72 L47 74 L45 94 L37 96 L34 82Z M64 72 L53 74 L55 94 L63 96 L66 82Z',
    hamstrings: 'M36 76 L47 78 L45 95 L37 96Z M64 76 L53 78 L55 95 L63 96Z',
    glutes: 'M39 64 Q44 61 49 66 L49 77 Q40 81 35 74Z M61 64 Q56 61 51 66 L51 77 Q60 81 65 74Z',
    abductors: 'M37 66 L41 70 L37 89 L33 82Z M63 66 L59 70 L63 89 L67 82Z',
    adductors: 'M43 73 L49 76 L46 91 L41 83Z M57 73 L51 76 L54 91 L59 83Z',
    calves: 'M37 99 L45 99 L43 114 L38 116 L35 108Z M63 99 L55 99 L57 114 L62 116 L65 108Z',
};
const BACK_GROUPS = new Set<MuscleGroup>(['traps', 'lats', 'middleBack', 'lowerBack', 'triceps', 'hamstrings', 'glutes', 'calves']);
const LOWER_GROUPS = new Set<MuscleGroup>(['quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors', 'calves']);

export function MuscleGroupIllustration({ group }: { group: MuscleGroup }) {
    if (group === 'cardio') return <HeartPulse aria-hidden="true" className="size-14 text-[var(--primary)]" strokeWidth={1.5} />;
    const back = BACK_GROUPS.has(group);
    return <svg viewBox={LOWER_GROUPS.has(group) ? '19 57 62 73' : '12 0 76 78'} aria-hidden="true" className="h-full w-full">
        <g fill="var(--muted-foreground)" fillOpacity="0.3" stroke="var(--muted-foreground)" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M42 12 Q42 3 50 3 Q58 3 58 12 L57 20 L54 24 L55 28 L67 32 Q74 34 76 43 L79 58 L84 75 L81 81 L77 79 L74 66 L69 53 L65 45 L61 57 L63 65 L67 77 L64 96 L66 107 L62 122 L66 126 L56 126 L54 106 L52 95 L50 80 L48 95 L46 106 L44 126 L34 126 L38 122 L34 107 L36 96 L33 77 L37 65 L39 57 L35 45 L31 53 L26 66 L23 79 L19 81 L16 75 L21 58 L24 43 Q26 34 33 32 L45 28 L46 24 L43 20Z" />
            {back ? <path d="M50 30 L50 64 M36 35 L45 43 L50 40 L55 43 L64 35 M37 74 Q44 79 50 75 Q56 79 63 74" fill="none" />
                : <path d="M35 34 Q43 30 50 35 Q57 30 65 34 M35 43 Q42 48 50 44 Q58 48 65 43 M50 35 L50 68 M42 53 L58 53 M42 60 L58 60" fill="none" />}
            <path d="M36 96 L45 96 M55 96 L64 96" fill="none" />
        </g>
        <path d={REGIONS[group]} fill="var(--primary)" stroke="var(--primary)" strokeWidth="0.5" />
    </svg>;
}
