import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AiChatClient } from '@/features/chat/components/AiChatClient';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations();
    return { title: t('ai.metaTitle') };
}

export default function AiChatPage() {
    return (
        <div className="fixed inset-0 z-150">
            {/* AiChatClient reads useSearchParams, which bails out of prerendering.
                Without a boundary here the export of /en|ko|ja|zh/ai-chat fails with
                "useSearchParams() should be wrapped in a suspense boundary" — the same
                wrapping the search and flight-search pages already do. */}
            <Suspense fallback={null}>
                <AiChatClient />
            </Suspense>
        </div>
    );
}
