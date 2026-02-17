import { useState } from 'react';
import { db } from '@/db/db';
import type { User } from '@/db/db';
import { useNavigate } from 'react-router-dom';
import { Rocket, User as UserIcon, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Language } from '@/i18n/translations';

export function OnboardingPage() {
    const navigate = useNavigate();
    const { t, setLanguage } = useLanguage();
    const [formData, setFormData] = useState<Partial<User>>({
        gender: 'other',
        language: 'en',
        reminderFrequency: 'weekly',
        theme: 'dark'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (field: keyof User, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
        handleChange('language', lang);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        setIsSubmitting(true);
        try {
            // Create user
            const userId = await db.users.add(formData as User);

            // Log initial measurements if provided
            if (formData.weight || formData.bodyFat) {
                await db.userMeasurements.add({
                    userId: userId as number,
                    weight: formData.weight,
                    bodyFat: formData.bodyFat,
                    timestamp: Date.now()
                });
            }

            navigate('/', { replace: true });
        } catch (error) {
            console.error("Failed to create user", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col p-6 animate-in fade-in duration-700 transition-colors duration-300">
            <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-8">
                <div className="text-center space-y-4">
                    <div className="size-16 bg-[var(--primary)]/20 text-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto ring-1 ring-[var(--primary)]/50 shadow-[0_0_15px_var(--primary)]/30">
                        <Rocket className="size-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('onboarding.welcome')}</h1>
                    <p className="text-[var(--muted-foreground)]">{t('onboarding.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6 bg-[var(--card)] border border-[var(--border)] p-6 rounded-3xl backdrop-blur-sm shadow-xl">

                    <div>
                        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.name')}</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3.5 size-5 text-[var(--muted-foreground)]" />
                            <input
                                required
                                type="text"
                                value={formData.name || ''}
                                onChange={e => handleChange('name', e.target.value)}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                                placeholder={t('onboarding.name')}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.weight')}</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.weight || ''}
                                onChange={e => handleChange('weight', parseFloat(e.target.value))}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-center text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors font-mono"
                                placeholder="-"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.height')}</label>
                            <input
                                type="number"
                                value={formData.height || ''}
                                onChange={e => handleChange('height', parseFloat(e.target.value))}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-center text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors font-mono"
                                placeholder="-"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.bodyFat')}</label>
                        <input
                            type="number"
                            step="0.1"
                            value={formData.bodyFat || ''}
                            onChange={e => handleChange('bodyFat', parseFloat(e.target.value))}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors font-mono"
                            placeholder="-"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.age')}</label>
                        <input
                            type="number"
                            value={formData.age || ''}
                            onChange={e => handleChange('age', parseInt(e.target.value))}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors font-mono"
                            placeholder="-"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.gender')}</label>
                        <select
                            value={formData.gender || 'other'}
                            onChange={e => handleChange('gender', e.target.value)}
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                        >
                            <option value="male">{t('onboarding.gender.male')}</option>
                            <option value="female">{t('onboarding.gender.female')}</option>
                            <option value="other">{t('onboarding.gender.other')}</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col h-full">
                            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.language')}</label>
                            <select
                                value={formData.language || 'en'}
                                onChange={e => handleLanguageChange(e.target.value as Language)}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors mt-auto"
                            >
                                <option value="en">{t('language.english')}</option>
                                <option value="de">{t('language.german')}</option>
                            </select>
                        </div>
                        <div className="flex flex-col h-full">
                            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{t('onboarding.reminders')}</label>
                            <select
                                value={formData.reminderFrequency || 'never'}
                                onChange={e => handleChange('reminderFrequency', e.target.value)}
                                className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors mt-auto"
                            >
                                <option value="never">{t('onboarding.reminders.never')}</option>
                                <option value="daily">{t('onboarding.reminders.daily')}</option>
                                <option value="weekly">{t('onboarding.reminders.weekly')}</option>
                                <option value="monthly">{t('onboarding.reminders.monthly')}</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!formData.name || isSubmitting}
                        className="w-full bg-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_var(--primary)]/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isSubmitting ? t('onboarding.creating') : (
                            <>
                                {t('onboarding.submit')} <ArrowRight className="size-5" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
