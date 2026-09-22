import { useEffect } from 'react';
import { cacheExerciseMedia } from '@/lib/exerciseMediaCache';

export function ExerciseMediaCache() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        void navigator.serviceWorker.ready.then(() => cacheExerciseMedia());
    }, []);
    return null;
}
