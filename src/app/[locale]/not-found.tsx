import { useTranslations } from 'next-intl';
import { Compass } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { StateScreen, stateActionClass, stateSecondaryClass } from '@/shared/components/StateScreen';

/**
 * A URL that names nothing.
 *
 * Reached by a stale link out of a chat window, a mistyped path, or a property that has
 * since been delisted. Until 2026-10-05 all of them got Next's default 404, which carries
 * neither the brand nor a route onward.
 *
 * Search is offered beside home deliberately: almost everyone who lands here was trying to
 * reach a specific stay, and the search page is the shortest way back to one.
 */
export default function LocaleNotFound() {
    const t = useTranslations('errors.page');

    return (
        <StateScreen
            full
            icon={Compass}
            title={t('notFoundTitle')}
            lines={[t('notFoundBody')]}
            actions={
                <>
                    <Link href="/" className={stateActionClass}>{t('goHome')}</Link>
                    <Link href="/search" className={stateSecondaryClass}>{t('searchStays')}</Link>
                </>
            }
        />
    );
}
