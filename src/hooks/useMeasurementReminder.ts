import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

export function useMeasurementReminder() {
    const user = useLiveQuery(() => db.users.orderBy('id').first());
    const lastMeasurement = useLiveQuery(() => db.userMeasurements.orderBy('timestamp').last());
    const [shouldRemind, setShouldRemind] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const timeoutId = window.setTimeout(() => {
            if (cancelled) return;

            if (!user || !user.reminderFrequency || user.reminderFrequency === 'never') {
                setShouldRemind(false);
                return;
            }

            const lastTime = lastMeasurement?.timestamp || 0;
            const now = Date.now();
            const diff = now - lastTime;

            // Time constants in milliseconds
            const DAY = 24 * 60 * 60 * 1000;
            const WEEK = 7 * DAY;
            const MONTH = 30 * DAY;

            let threshold = 0;
            switch (user.reminderFrequency) {
                case 'daily': threshold = DAY; break;
                case 'weekly': threshold = WEEK; break;
                case 'monthly': threshold = MONTH; break;
            }

            // Only remind if threshold passed AND user is logged in
            setShouldRemind(threshold > 0 && diff > threshold);
        }, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [user, lastMeasurement]);

    return shouldRemind;
}
