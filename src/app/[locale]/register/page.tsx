import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { RegisterForm } from '@/features/auth/components/register-form';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('auth');
    return { title: t('createAccount') };
}

export default function RegisterPage() {
    const t = useTranslations('auth');
    return (
        <AuthLayout
            title={t('createYourAccount')}
            subtitle={t('registerSubtitle')}
            pitch={t('registerPitch')}
        >
            <RegisterForm />
        </AuthLayout>
    );
}
