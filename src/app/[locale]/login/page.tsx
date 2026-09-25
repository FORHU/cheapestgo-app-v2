import { BRAND_NAME } from '@/shared/lib/brand';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata = { title: `Sign in — ${BRAND_NAME}` };

export default function LoginPage() {
    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your account to continue"
            pitch="Your trips, your saved searches, and every booking in one place."
        >
            <LoginForm />
        </AuthLayout>
    );
}
