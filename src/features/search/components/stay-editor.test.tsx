/**
 * The search page's bar showed the stay — dates and guests — as text the traveller
 * could not change without going back to the landing page and starting over.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import { StayEditor } from './stay-editor';

const stay = { checkIn: '2026-10-28', checkOut: '2026-10-30', adults: 2, children: 0, rooms: 1 };

describe('StayEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-06T09:00:00'));
    });
    afterEach(() => vi.useRealTimers());

    const open = async (onApply = vi.fn()) => {
        const user = userEvent.setup();
        renderWithIntl(<StayEditor {...stay} tone="dark" onApply={onApply} />);
        await user.click(screen.getByRole('button', { name: /Oct 28 – Oct 30.*2 guests/ }));
        return { user, onApply };
    };

    it('shows the current stay and opens on its month', async () => {
        await open();
        expect(screen.getByText('October 2026')).toBeInTheDocument();
    });

    it('applies new dates and guests together', async () => {
        const { user, onApply } = await open();

        await user.click(screen.getByRole('button', { name: 'next month' }));
        await user.click(screen.getByRole('button', { name: 'November 3, 2026' }));
        await user.click(screen.getByRole('button', { name: 'November 7, 2026' }));
        await user.click(screen.getByRole('button', { name: 'Add Adults' }));
        await user.click(screen.getByRole('button', { name: 'Add Children' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(onApply).toHaveBeenCalledWith({
            checkIn: '2026-11-03', checkOut: '2026-11-07', adults: 3, children: 1, rooms: 1,
        });
    });

    it('will not take a past day or a check-out before check-in', async () => {
        const { user, onApply } = await open();

        expect(screen.getByRole('button', { name: 'October 5, 2026' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'next month' }));
        await user.click(screen.getByRole('button', { name: 'November 7, 2026' }));
        await user.click(screen.getByRole('button', { name: 'November 3, 2026' }));   // earlier → restarts the range
        await user.click(screen.getByRole('button', { name: 'Done' }));

        // Only a check-in is set, so nothing is applied and the editor stays open.
        expect(onApply).not.toHaveBeenCalled();
    });

    it('keeps at least one adult and one room', async () => {
        await open();
        expect(screen.getByRole('button', { name: 'Remove Rooms' })).toBeDisabled();
    });
});
