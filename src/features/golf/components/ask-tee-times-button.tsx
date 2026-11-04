'use client';

import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/shared/auth/store';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';

/**
 * The golf course page's one action until tee-time booking is ported: open the support chat.
 *
 * The chat exists only for someone signed in (ADR-0032), so a signed-out visitor is sent to sign in
 * and brought back, the way checkout does it. Disabled while the session is still being read, so a
 * signed-in customer is not sent to the login page by a click that came too early.
 *
 * With a `draft` (a tee time picked on the course page) it asks about that tee time: the chat opens
 * with the draft in its message box, for the customer to send.
 */
export function AskTeeTimesButton({ draft }: { draft?: string }) {
    const t = useTranslations('golf');
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const checking = useAuthStore((s) => s.isLoading);
    const requestOpen = useSupportWidget((s) => s.requestOpen);

    const ask = () => {
        if (user) {
            requestOpen(draft);
            return;
        }
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={ask}
                disabled={checking}
                className="inline-flex h-12 w-full items-center justify-center gap-2 bg-slate-900 px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
                <MessageCircle size={16} aria-hidden />
                {draft ? t('teeTimes.askThis') : t('askTeeTimes')}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {user || checking ? t('askHint') : t('askSignIn')}
            </p>
        </div>
    );
}
