import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountView } from '@/features/account/components/account-view';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('account');
    return {
        title:  t('title'),
        robots: { index: false, follow: false },
    };
}

export default function AccountPage() {
    return <AccountView />;
}
