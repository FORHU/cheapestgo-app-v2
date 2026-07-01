'use client';

import React, { useEffect, useState } from 'react';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { cn } from '@/shared/lib/cn';
import { CURRENCIES } from '@/shared/lib/currency';
import type { UserPreferences } from '@/shared/types';

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' },
    { code: 'ja', label: '日本語' },
    { code: 'cn', label: '中文' },
] as const;

export function PreferencesSection() {
    const [prefs, setPrefs] = useState<UserPreferences>({
        currency: 'USD',
        language: 'en',
        email_notifications: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        http.get<{ data?: UserPreferences } | UserPreferences>('/api/users/preferences')
            .then(res => {
                const data = 'data' in res && res.data ? res.data : res as UserPreferences;
                setPrefs(prev => ({ ...prev, ...data }));
            })
            .catch(() => {/* Use defaults on failure */})
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            await http.patch('/users/preferences', prefs);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save preferences.';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Preferences</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Customize your browsing and notification settings.</p>
            </div>

            {/* Currency */}
            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Display Currency
                </label>
                <select
                    value={prefs.currency ?? 'USD'}
                    onChange={e => setPrefs(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                    {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                            {c.code} — {c.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Language */}
            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Language
                </label>
                <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => setPrefs(prev => ({ ...prev, language: lang.code }))}
                            className={cn(
                                'px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                                prefs.language === lang.code
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700'
                            )}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Notifications */}
            <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Notifications
                </label>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl">
                    <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Email notifications</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Booking confirmations, price alerts, and trip reminders
                        </p>
                    </div>
                    <button
                        onClick={() => setPrefs(prev => ({ ...prev, email_notifications: !prev.email_notifications }))}
                        className={cn(
                            'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                            prefs.email_notifications ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                        role="switch"
                        aria-checked={prefs.email_notifications}
                    >
                        <span
                            className={cn(
                                'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5',
                                prefs.email_notifications ? 'translate-x-5' : 'translate-x-0.5'
                            )}
                        />
                    </button>
                </div>
            </div>

            {/* Save */}
            {error && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
                {saving
                    ? <Loader2 size={14} className="animate-spin" />
                    : saved
                    ? <CheckCircle size={14} />
                    : <Save size={14} />
                }
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Preferences'}
            </button>
        </div>
    );
}
