import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { LoginForm } from '@/features/auth/components/login-form';
import { StaffLandingRedirect } from '@/features/auth/components/staff-landing-redirect';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('auth.staff');
    return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * The staff door.
 *
 * Customers sign in at `/login`; this is the one support staff bookmark. Same
 * credentials, same session, same cookie — what differs is where you land and what you
 * are told if you do not belong here.
 *
 * Not a security boundary. Nothing is granted by arriving through this URL rather than
 * the other one: the roles decide, and they decide identically at both doors. What it
 * buys is that a Support Agent has an address of their own and is never dropped on the
 * marketing site wondering where the inbox went.
 */
export default function StaffLoginPage() {
    const t = useTranslations('auth.staff');
    return (
        <>
            <StaffLandingRedirect />
            <AuthLayout title={t('title')} subtitle={t('subtitle')} pitch={t('pitch')}>
                <LoginForm />
            </AuthLayout>
        </>
    );
}
