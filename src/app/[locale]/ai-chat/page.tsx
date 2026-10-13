import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AiChatClient } from '@/features/chat/components/AiChatClient';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations();
    return { title: t('ai.metaTitle') };
}

export default function AiChatPage() {
    return (
        <div className="fixed inset-0 z-150">
            <AiChatClient />
        </div>
    );
}
