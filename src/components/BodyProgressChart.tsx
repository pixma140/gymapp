import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';

export function BodyProgressChart() {
    const data = useLiveQuery(async () => {
        const measurements = await db.userMeasurements.orderBy('timestamp').toArray();
        return measurements.map(m => ({
            date: new Date(m.timestamp).toLocaleDateString(),
            weight: m.weight,
            bodyFat: m.bodyFat
        }));
    });

    if (!data) return <div className="text-[var(--muted-foreground)]">Loading charts...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 h-64 w-full">
                <h3 className="text-sm font-bold text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">Weight History</h3>
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Weight (kg)" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-sm">
                        No weight data. Update your profile to track history.
                    </div>
                )}
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 h-64 w-full">
                <h3 className="text-sm font-bold text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">Body Fat History</h3>
                {data.length > 0 && data.some(d => d.bodyFat) ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Line type="monotone" dataKey="bodyFat" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Body Fat (%)" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-sm">
                        No body fat data.
                    </div>
                )}
            </div>
        </div>
    );
}
