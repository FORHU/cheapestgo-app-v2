'use client';

import React, { useState } from 'react';
import { User, Mail, KeyRound, CheckCircle, Loader2 } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { useAuthStore } from '@/shared/auth/store';

export function ProfileSection() {
    const { user } = useAuthStore();
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    if (!user) return null;

    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
    const initials = (user.first_name?.[0] ?? user.email[0]).toUpperCase();

    const handleChangePassword = async () => {
        setResetLoading(true);
        setResetError(null);
        try {
            await http.post('/api/auth/request-reset', { email: user.email });
            setResetSent(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to send reset link. Please try again.';
            setResetError(msg);
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Profile</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Your personal account information.</p>
            </div>

            {/* Avatar + Name */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-white/5">
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {initials}
                </div>
                <div>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{displayName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                    {user.role === 'admin' && (
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full uppercase tracking-wide">
                            Admin
                        </span>
                    )}
                </div>
            </div>

            {/* Fields */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                        Email address
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white">
                        <Mail size={14} className="text-slate-400 shrink-0" />
                        {user.email}
                        <span className="ml-auto text-[10px] font-medium text-slate-400">(read-only)</span>
                    </div>
                </div>

                {(user.first_name || user.last_name) && (
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                            Display name
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white">
                            <User size={14} className="text-slate-400 shrink-0" />
                            {displayName}
                        </div>
                    </div>
                )}
            </div>

            {/* Change Password */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    We'll send a password reset link to your email.
                </p>

                {resetSent ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
                        <CheckCircle size={15} />
                        Reset link sent to {user.email}
                    </div>
                ) : (
                    <>
                        {resetError && (
                            <p className="mb-2 text-xs text-red-600 dark:text-red-400">{resetError}</p>
                        )}
                        <button
                            onClick={handleChangePassword}
                            disabled={resetLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                            {resetLoading ? 'Sending…' : 'Change Password'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
