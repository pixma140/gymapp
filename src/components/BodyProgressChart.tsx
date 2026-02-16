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

    if (!data) return <div className="text-zinc-500">Loading charts...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-64 w-full">
                <h3 className="text-sm font-bold text-zinc-400 mb-2 uppercase tracking-wider">Weight History</h3>
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Weight (kg)" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                        No weight data. Update your profile to track history.
                    </div>
                )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-64 w-full">
                <h3 className="text-sm font-bold text-zinc-400 mb-2 uppercase tracking-wider">Body Fat History</h3>
                {data.length > 0 && data.some(d => d.bodyFat) ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Line type="monotone" dataKey="bodyFat" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Body Fat (%)" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                        No body fat data.
                    </div>
                )}
            </div>
        </div>
    );
}
