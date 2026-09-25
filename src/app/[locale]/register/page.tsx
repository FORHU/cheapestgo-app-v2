import { BRAND_NAME } from '@/shared/lib/brand';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata = { title: `Create account — ${BRAND_NAME}` };

export default function RegisterPage() {
    return (
        <AuthLayout
            title="Create your account"
            subtitle="Start finding the cheapest fares worldwide"
            pitch="One account. Every fare we can find, on every route we cover."
        >
            <RegisterForm />
        </AuthLayout>
    );
}
