import { AiChatClient } from '@/features/chat/components/AiChatClient';

export const metadata = { title: 'Cheap — AI Travel Assistant' };

export default function AiChatPage() {
    return (
        <div className="fixed inset-0 z-150">
            <AiChatClient />
        </div>
    );
}
