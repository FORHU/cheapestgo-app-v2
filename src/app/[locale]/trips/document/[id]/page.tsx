import type { Metadata } from 'next';
import { TravelDocumentView } from '@/features/trips/components/travel-document-view';

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function TravelDocumentPage() {
    return <TravelDocumentView />;
}
