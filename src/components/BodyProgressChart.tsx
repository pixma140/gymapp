import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useLanguage } from '@/i18n/LanguageContext';

export function BodyProgressChart({ rangeDays }: { rangeDays: number }) {
    const { t } = useLanguage();
    const data = useLiveQuery(async () => {
        const measurements = await db.userMeasurements.orderBy('timestamp').toArray();
        return measurements.map(m => ({
            date: new Date(m.timestamp).toLocaleDateString(),
            weight: m.weight,
            bodyFat: m.bodyFat,
            timestamp: m.timestamp
        }));
    });

    if (!data) return <div className="text-[var(--muted-foreground)]">{t('charts.loading')}</div>;

    const cutoff = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);
    const filteredData = data.filter(point => point.timestamp >= cutoff);

    return (
        <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 h-64 w-full">
                <h3 className="text-sm font-bold text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">{t('charts.weightHistory')}</h3>
                {filteredData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={filteredData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)' }} name="Weight (kg)" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-sm">
                        {t('charts.noWeight')}
                    </div>
                )}
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 h-64 w-full">
                <h3 className="text-sm font-bold text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">{t('charts.bodyFatHistory')}</h3>
                {filteredData.length > 0 && filteredData.some(d => d.bodyFat) ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={filteredData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Line type="monotone" dataKey="bodyFat" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)' }} name="Body Fat (%)" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-sm">
                        {t('charts.noBodyFat')}
                    </div>
                )}
            </div>
        </div>
    );
}
