import type { Metadata } from 'next';
import { LandingHeader } from '@/features/landing/components/landing-header';
import { FlatGround } from '@/shared/components/common/FlatGround';
import { TravelDocumentView } from '@/features/trips/components/travel-document-view';

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

/**
 * A booking's document, under the bar and on the ground the booking it came from has
 * (`trips/[id]/page.tsx`) — so opening a receipt does not feel like leaving the app. The bar
 * is screen-only: the printed and downloaded copy is the document alone.
 */
export default function TravelDocumentPage() {
    return (
        <div className="min-h-screen flex flex-col print:min-h-0">
            <FlatGround />
            <div className="print:hidden">
                <LandingHeader tone="default" />
            </div>
            <TravelDocumentView />
        </div>
    );
}
