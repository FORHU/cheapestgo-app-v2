import { SupportDeskView } from '@/features/support/components/SupportDeskView';

/**
 * The desk's inbox — the same component the full back office uses.
 *
 * Shared rather than copied: two inboxes would drift, and the one an Agent uses less often
 * is the one that would rot. What differs is the chrome around it, not the work.
 */
export default function DeskInboxPage() {
    return (
        <div className="space-y-4 p-4 sm:p-6">
            <header>
                <h2 className="text-xl font-semibold text-slate-900">Inbox</h2>
                <p className="text-sm text-slate-500">
                    Waiting chats come first by how close the customer is to travelling.
                </p>
            </header>
            <SupportDeskView />
        </div>
    );
}
