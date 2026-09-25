import { BRAND_NAME } from '@/shared/lib/brand';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password';

export const metadata = { title: `Reset your password — ${BRAND_NAME}` };

/**
 * The route the sign-in page has always linked to.
 *
 * `ForgotPasswordForm` existed and was never mounted anywhere, so "Forgot password?" answered
 * 404 — on the one screen reached by people who cannot get in by any other means.
 */
export default function ForgotPasswordPage() {
    return (
        <AuthLayout
            title="Reset your password"
            subtitle="We will email you a link to set a new one"
            pitch="Locked out is temporary. Your trips are still where you left them."
        >
            <ForgotPasswordForm />
        </AuthLayout>
    );
}
