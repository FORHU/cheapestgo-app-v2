import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('auth');
    return { title: t('resetYourPassword') };
}

/**
 * The route the sign-in page has always linked to.
 *
 * `ForgotPasswordForm` existed and was never mounted anywhere, so "Forgot password?" answered
 * 404 — on the one screen reached by people who cannot get in by any other means.
 */
export default function ForgotPasswordPage() {
    const t = useTranslations('auth');
    return (
        <AuthLayout
            title={t('resetYourPassword')}
            subtitle={t('forgotSubtitle')}
            pitch={t('forgotPitch')}
        >
            <ForgotPasswordForm />
        </AuthLayout>
    );
}
