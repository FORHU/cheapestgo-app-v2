'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { StateScreen, stateActionClass, stateSecondaryClass } from '@/shared/components/StateScreen';

/**
 * Where an OAuth round trip lands when it fails.
 *
 * v2 has Google sign-in, and `auth/google/callback` can fail the same ways v1's could —
 * an expired code, one already spent — but this page was never ported, so that path
 * ended on a 404. The copy is v1's, already translated in all four languages.
 */
export default function AuthCodeErrorPage() {
    const t = useTranslations('errors.auth');
    return (
        <StateScreen
            full
            icon={AlertTriangle}
            title={t('title')}
            lines={[t('description')]}
            actions={
                <>
                    <Link href="/login" className={stateActionClass}>{t('signInAgain')}</Link>
                    <Link href="/" className={stateSecondaryClass}>{t('goHome')}</Link>
                </>
            }
        />
    );
}
