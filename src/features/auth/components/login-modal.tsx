'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LoginForm } from '@/features/auth/components/login-form';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';

export function LoginModal() {
    const isOpen = useAuthStore((state) => state.isAuthModalOpen);
    const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
    const t = useTranslations();

    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (!isOpen) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeAuthModal();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [isOpen, closeAuthModal]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeAuthModal();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-modal-title"
                className="relative my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-8"
            >
                <button
                    type="button"
                    onClick={closeAuthModal}
                    aria-label={t('common.close')}
                    className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                    <X size={20} aria-hidden="true" />
                </button>

                <h2
                    id="login-modal-title"
                    className="mb-6 pr-10 font-display text-2xl font-bold text-slate-900 dark:text-white"
                >
                    {t('auth.welcomeBack')}
                </h2>

                <LoginForm onSuccess={closeAuthModal} />
            </section>
        </div>
    );
}
