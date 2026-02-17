import { cn } from '@/lib/utils';

interface TabsProps {
    tabs: { id: string; label: string }[];
    activeTab: string;
    onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
    return (
        <div className="flex p-1 bg-[var(--card)] rounded-xl border border-[var(--border)]">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                        activeTab === tab.id
                            ? "bg-[var(--accent)] text-[var(--foreground)] shadow-sm"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
