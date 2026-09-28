import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { LoginForm } from '@/features/auth/components/login-form';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations();
    return { title: t('nav.signIn') };
}

export default function LoginPage() {
    const t = useTranslations('auth');
    return (
        <AuthLayout
            title={t('welcomeBack')}
            subtitle={t('signInToContinue')}
            pitch={t('loginPitch')}
        >
            <LoginForm />
        </AuthLayout>
    );
}
