import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { LoginForm } from '@/features/auth/components/login-form';
import { StaffLandingRedirect } from '@/features/auth/components/staff-landing-redirect';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations();
    return { title: t('nav.signIn') };
}

export default function LoginPage() {
    const t = useTranslations('auth');
    return (
        <>
            {/*
              * Staff who are already signed in belong at their console, not here.
              *
              * This used to sit only on `/support/login`, which the staff host redirects away
              * (`src/middleware.ts` sends everything but `/login` to `/admin`) — so the one door
              * staff can actually reach was the one with no role routing on it, and an Agent
              * signing in was dropped on the landing page by `returnPath()`.
              */}
            <StaffLandingRedirect />
            <AuthLayout
                title={t('welcomeBack')}
                subtitle={t('signInToContinue')}
                pitch={t('loginPitch')}
            >
                <LoginForm />
            </AuthLayout>
        </>
    );
}
