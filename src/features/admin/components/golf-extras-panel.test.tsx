import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import type { GolfCourse } from '@/features/golf/types';

const adminGolfApi = vi.hoisted(() => ({ listExtras: vi.fn(), setExtras: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => ({ adminGolfApi }));

import { GolfExtrasPanel } from '@/features/admin/components/golf-extras-panel';

const course = { id: 'c1', currency: 'PHP' } as GolfCourse;
const price = (name: string) => screen.findByRole('spinbutton', { name: new RegExp(`^${name} price`) });

beforeEach(() => {
    vi.clearAllMocks();
    adminGolfApi.listExtras.mockResolvedValue([{ code: 'caddie', price: 600 }]);
    adminGolfApi.setExtras.mockImplementation(async (_id: string, extras: unknown) => extras);
});

describe('GolfExtrasPanel', () => {
    it('shows what the course offers, and leaves the rest switched off', async () => {
        renderWithIntl(<GolfExtrasPanel course={course} />);
        expect(await price('Caddie')).toHaveValue(600);
        expect(screen.getByRole('checkbox', { name: 'Caddie' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Golf cart' })).not.toBeChecked();
        expect(await price('Golf cart')).toBeDisabled();
    });

    it('saves the whole set, in list order', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfExtrasPanel course={course} />);
        await user.click(await screen.findByRole('checkbox', { name: 'Club rental' }));
        await user.type(await price('Club rental'), '1500');
        await user.click(screen.getByRole('button', { name: 'Save extras' }));
        await waitFor(() => expect(adminGolfApi.setExtras).toHaveBeenCalledWith('c1', [
            { code: 'club_rental', price: 1500 }, { code: 'caddie', price: 600 },
        ]));
        expect(await screen.findByRole('status')).toHaveTextContent('Extras saved');
    });

    it('offers lessons and range balls with the rest', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfExtrasPanel course={course} />);
        await user.click(await screen.findByRole('checkbox', { name: 'Golf lesson' }));
        await user.type(await price('Golf lesson'), '2000');
        await user.click(screen.getByRole('checkbox', { name: 'Bucket of range balls' }));
        await user.type(await price('Bucket of range balls'), '250');
        await user.click(screen.getByRole('button', { name: 'Save extras' }));
        await waitFor(() => expect(adminGolfApi.setExtras).toHaveBeenCalledWith('c1', [
            { code: 'caddie', price: 600 }, { code: 'lessons', price: 2000 }, { code: 'range_balls', price: 250 },
        ]));
    });

    it('takes an extra off when it is switched off', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfExtrasPanel course={course} />);
        await user.click(await screen.findByRole('checkbox', { name: 'Caddie' }));
        await user.click(screen.getByRole('button', { name: 'Save extras' }));
        await waitFor(() => expect(adminGolfApi.setExtras).toHaveBeenCalledWith('c1', []));
    });

    it('will not save an offered extra with no price as free', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfExtrasPanel course={course} />);
        await user.click(await screen.findByRole('checkbox', { name: 'Golf cart' }));
        await user.click(screen.getByRole('button', { name: 'Save extras' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Give each extra you offer a price.');
        expect(adminGolfApi.setExtras).not.toHaveBeenCalled();
    });

    it('says so when saving fails, and keeps what was typed', async () => {
        adminGolfApi.setExtras.mockRejectedValueOnce(new Error('nope'));
        const user = userEvent.setup();
        renderWithIntl(<GolfExtrasPanel course={course} />);
        await user.click(await screen.findByRole('checkbox', { name: 'Caddie' }));
        await user.click(screen.getByRole('button', { name: 'Save extras' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('nope');
        expect(screen.getByRole('checkbox', { name: 'Caddie' })).not.toBeChecked();
    });
});
