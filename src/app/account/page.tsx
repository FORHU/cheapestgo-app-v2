'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, Heart, Bell } from 'lucide-react';
import { Header } from '@/shared/components/header';
import { useAuthStore } from '@/shared/auth/store';
import { ProfileSection } from '@/features/account/components/profile-section';
import { PreferencesSection } from '@/features/account/components/preferences-section';
import { SavedTripsSection } from '@/features/account/components/saved-trips-section';
import { PriceAlertsSection } from '@/features/account/components/price-alerts-section';
import { cn } from '@/shared/lib/cn';

// ─── Tabs config ──────────────────────────────────────────────────────────────

type TabId = 'profile' | 'preferences' | 'saved' | 'alerts';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',     label: 'Profile',      icon: <User size={15} /> },
    { id: 'preferences', label: 'Preferences',  icon: <Settings size={15} /> },
    { id: 'saved',       label: 'Saved',        icon: <Heart size={15} /> },
    { id: 'alerts',      label: 'Alerts',       icon: <Bell size={15} /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
    const router = useRouter();
    const { user, isLoading, fetchUser } = useAuthStore();
    const [activeTab, setActiveTab] = useState<TabId>('profile');

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login?next=/account');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
                <Header />
                <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 animate-pulse">
                    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-6" />
                    <div className="flex gap-2 mb-6">
                        {TABS.map(t => (
                            <div key={t.id} className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                        ))}
                    </div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">My Account</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        Manage your profile, preferences, and saved items.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 mb-6 border-b border-slate-200 dark:border-white/10">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap',
                                activeTab === tab.id
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6">
                    {activeTab === 'profile'     && <ProfileSection />}
                    {activeTab === 'preferences' && <PreferencesSection />}
                    {activeTab === 'saved'       && <SavedTripsSection />}
                    {activeTab === 'alerts'      && <PriceAlertsSection />}
                </div>
            </main>
        </div>
    );
}
