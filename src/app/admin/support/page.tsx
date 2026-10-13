import { SupportDeskView } from '@/features/support/components/SupportDeskView';

/**
 * The Support Desk.
 *
 * Reachable by a Support Agent as well as an admin: an Agent answers chats and can do nothing
 * else in /admin, so the API decides per action rather than shutting them out at the door.
 */
export default function SupportDeskPage() {
    return (
        <div className="space-y-4">
            <header>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Support</h1>
                <p className="text-sm text-slate-500">
                    Waiting chats come first by how close the customer is to travelling.
                </p>
            </header>
            <SupportDeskView />
        </div>
    );
}
