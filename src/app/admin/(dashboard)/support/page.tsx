import { SupportDeskView } from '@/features/support/components/SupportDeskView';

/**
 * The inbox as an Admin reaches it, inside the back office.
 *
 * Admins only. This used to claim a Support Agent could reach it too — the API does decide
 * per action, but the `(dashboard)` layout around this page has always required `admin` and
 * redirected everyone else, so an Agent sent here was bounced to the storefront and never
 * saw an inbox at all. An Agent's door is `/admin/desk`, which renders the same view under a
 * gate that admits them.
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
