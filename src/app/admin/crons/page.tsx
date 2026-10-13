import type { Metadata } from 'next';
import { CronsView } from '@/features/admin/components/crons-view';

export const metadata: Metadata = {
    title: 'Scheduled jobs | Admin',
    robots: { index: false, follow: false },
};

export default function AdminCronsPage() {
    return <CronsView />;
}
