/**
 * The staff tree renders without the storefront's intl provider.
 *
 * `/admin` is outside `[locale]`, so in production nothing wraps it — and `useTranslations`
 * throws when there is no provider. next-intl strips the message from a production build, so
 * the symptom was a bare `Error` with no text and a route stuck on its error boundary.
 *
 * The existing SupportDeskView tests all mount inside `NextIntlClientProvider`, which is
 * precisely why they stayed green while the page was broken for staff. Everything here
 * renders with *no* provider, the way production does.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslations } from 'next-intl';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminLayout from '@/app/admin/layout';
import { SupportDeskView } from '@/features/support/components/SupportDeskView';
import { useAuthStore } from '@/shared/auth/store';

const api = vi.hoisted(() => ({
    fetchInbox:                 vi.fn(),
    fetchConversationForAgent:  vi.fn(),
    replyAsAgent:               vi.fn(),
    assignConversation:         vi.fn(),
    returnToQueue:              vi.fn(),
    resolveConversation:        vi.fn(),
    fetchDeskStaff:             vi.fn(),
    openDeskStream:             vi.fn(),
    agentAttachmentHref:        vi.fn(() => '/x'),
    uploadAgentAttachment:      vi.fn(),
}));
vi.mock('@/features/support/api/adminSupport.api', () => api);

const row = {
    id: 'c1', reference: 'CG-1001', status: 'waiting_human', locale: 'ko',
    createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T09:00:00.000Z',
    urgency: 'travelling_now', assignedAdminId: null,
    customerEmail: 'traveller@example.com', messageCount: 2,
};

describe('admin layout supplies English to the staff routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.fetchInbox.mockResolvedValue([row]);
        api.fetchConversationForAgent.mockResolvedValue({
            conversation: { ...row, assignedAdminId: 'a1' },
            messages: [{
                id: 'm1', senderType: 'guest', body: 'hello', noticeCode: null,
                translatedBody: null, translatedLang: null, translationStatus: 'none',
                createdAt: '2026-09-25T10:00:00.000Z', attachments: [],
            }],
            canWrite: true,
        });
        api.fetchDeskStaff.mockResolvedValue([]);
        api.openDeskStream.mockReturnValue({ addEventListener: vi.fn(), close: vi.fn() });
        useAuthStore.setState({ user: { id: 'a1', email: 'agent@example.com', role: 'admin' } as never });
    });

    /** Both namespaces the staff screens read, named so a dropped one fails by name. */
    function Probe() {
        const t = useTranslations();
        return <span>{`${t('common.close')}|${t('support.attach')}`}</span>;
    }

    it('serves the namespaces staff components read', () => {
        render(<AdminLayout><Probe /></AdminLayout>);
        expect(screen.getByText('Close|Attach a file')).toBeInTheDocument();
    });

    it('opens a chat without the composer throwing', async () => {
        // The composer calls useTranslations, so it threw the moment a chat was opened —
        // the inbox itself rendered fine, which is why this looked like a data problem.
        render(<AdminLayout><SupportDeskView /></AdminLayout>);

        await waitFor(() => expect(api.fetchInbox).toHaveBeenCalled());
        await userEvent.click(await screen.findByText('traveller@example.com'));

        expect(await screen.findByLabelText('Attach a file')).toBeInTheDocument();
    });
});
