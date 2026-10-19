import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { checkoutPalette } from '../../lib/palette';
import {
    BookingFailedPanel,
    MultiRoomNotice,
    PriceMovedPanel,
    RoomUnavailablePanel,
    SettlingPanel,
    SupplierDownPanel,
} from '../booking-state-panels';

const palette = checkoutPalette('light');

const wrap = (ui: React.ReactElement) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>);

describe('PriceMovedPanel', () => {
    const rise = { previous: 240, current: 259.2, direction: 'up' as const, currency: 'USD' };

    it('says the price rose, and shows both figures', () => {
        wrap(<PriceMovedPanel change={rise} palette={palette} onAccept={vi.fn()} onChooseAnother={vi.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent(/price has changed/i);
        expect(screen.getByText(/costs more/i)).toBeInTheDocument();
        expect(screen.getByText(/\$240/)).toBeInTheDocument();
        expect(screen.getByText(/\$259\.20/)).toBeInTheDocument();
    });

    it('says so, kindly, when it fell', () => {
        wrap(<PriceMovedPanel change={{ ...rise, current: 228, direction: 'down' }} palette={palette}
            onAccept={vi.fn()} onChooseAnother={vi.fn()} />);
        expect(screen.getByText(/costs less/i)).toBeInTheDocument();
    });

    it('offers to go on at the new price, or to leave', () => {
        const onAccept = vi.fn();
        const onChooseAnother = vi.fn();
        wrap(<PriceMovedPanel change={rise} palette={palette} onAccept={onAccept} onChooseAnother={onChooseAnother} />);

        fireEvent.click(screen.getByRole('button', { name: /continue at the new price/i }));
        fireEvent.click(screen.getByRole('button', { name: /choose another room/i }));

        expect(onAccept).toHaveBeenCalledTimes(1);
        expect(onChooseAnother).toHaveBeenCalledTimes(1);
    });

    it('fills the way forward with the brand gradient, and leaves the way out plain', () => {
        wrap(<PriceMovedPanel change={rise} palette={palette} onAccept={vi.fn()} onChooseAnother={vi.fn()} />);

        expect(screen.getByRole('button', { name: /continue at the new price/i }).getAttribute('style')).toMatch(/linear-gradient/);
        expect(screen.getByRole('button', { name: /choose another room/i }).getAttribute('style')).not.toMatch(/linear-gradient/);
    });

    it('does not let a price be accepted that has not been shown yet', () => {
        wrap(<PriceMovedPanel palette={palette} refreshing onAccept={vi.fn()} onChooseAnother={vi.fn()} />);

        expect(screen.getByText(/checking the latest price/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue at the new price/i })).toBeDisabled();
    });

    it('formats an amount in a currency with no minor unit as whole units', () => {
        wrap(<PriceMovedPanel change={{ previous: 100000, current: 105000, direction: 'up', currency: 'KRW' }}
            palette={palette} onAccept={vi.fn()} onChooseAnother={vi.fn()} />);
        expect(screen.getByText(/105,000/)).toBeInTheDocument();
    });
});

describe('RoomUnavailablePanel', () => {
    it('says the room is gone and that nothing was charged, with no way to retry', () => {
        const onChooseAnother = vi.fn();
        wrap(<RoomUnavailablePanel kind="unavailable" palette={palette} onChooseAnother={onChooseAnother} />);

        expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i);
        expect(screen.getByText(/have not been charged/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /choose another room/i }));
        expect(onChooseAnother).toHaveBeenCalledTimes(1);
    });

    it('explains a room that can only be paid for at the hotel', () => {
        wrap(<RoomUnavailablePanel kind="not_payable_online" palette={palette} onChooseAnother={vi.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent(/can't be paid for online/i);
    });
});

describe('SupplierDownPanel', () => {
    it('says nothing is wrong with the booking and offers a retry', () => {
        const onRetry = vi.fn();
        wrap(<SupplierDownPanel palette={palette} onRetry={onRetry} />);

        expect(screen.getByText(/nothing is wrong with your booking/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('cannot be retried while a retry is under way', () => {
        wrap(<SupplierDownPanel palette={palette} onRetry={vi.fn()} busy />);
        expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
    });
});

describe('SettlingPanel', () => {
    it('tells a booking in progress not to be paid for again', () => {
        wrap(<SettlingPanel phase="pending" reference="CG-ABC123" palette={palette} onViewTrips={vi.fn()} />);

        expect(screen.getByRole('status')).toHaveTextContent(/confirming your booking/i);
        expect(screen.getByText(/won't be charged twice/i)).toBeInTheDocument();
        expect(screen.getByText('CG-ABC123')).toBeInTheDocument();
    });

    it('says the payment is on hold, not taken, when the outcome is unknown', () => {
        wrap(<SettlingPanel phase="needs_review" reference="CG-ABC123" palette={palette} onViewTrips={vi.fn()} />);

        expect(screen.getByRole('status')).toHaveTextContent(/confirming this with the hotel/i);
        expect(screen.getByText(/hasn't been taken yet/i)).toBeInTheDocument();
    });

    it('works without a reference rather than printing "undefined"', () => {
        wrap(<SettlingPanel phase="pending" palette={palette} onViewTrips={vi.fn()} />);
        expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    });

    it('leads to the trips, where the answer will be', () => {
        const onViewTrips = vi.fn();
        wrap(<SettlingPanel phase="needs_review" palette={palette} onViewTrips={onViewTrips} />);
        fireEvent.click(screen.getByRole('button', { name: /view my trips/i }));
        expect(onViewTrips).toHaveBeenCalledTimes(1);
    });
});

describe('BookingFailedPanel', () => {
    it('says the hold was released when it was', () => {
        wrap(<BookingFailedPanel released message="Room is gone" palette={palette} onTryAgain={vi.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent(/couldn't complete your booking/i);
        expect(screen.getByText(/have not been charged/i)).toBeInTheDocument();
        expect(screen.getByText('Room is gone')).toBeInTheDocument();
    });

    it('does not claim that money was released when it does not know', () => {
        wrap(<BookingFailedPanel released={false} message="Booking failed" palette={palette} onTryAgain={vi.fn()} />);

        expect(screen.queryByText(/have not been charged/i)).not.toBeInTheDocument();
        expect(screen.getByText(/couldn't confirm whether your payment was taken/i)).toBeInTheDocument();
    });

    it('offers another go', () => {
        const onTryAgain = vi.fn();
        wrap(<BookingFailedPanel released message="x" palette={palette} onTryAgain={onTryAgain} />);
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(onTryAgain).toHaveBeenCalledTimes(1);
    });
});

describe('MultiRoomNotice', () => {
    it('says plainly that one room is being booked for the whole party', () => {
        wrap(<MultiRoomNotice palette={palette} />);
        expect(screen.getByRole('note')).toHaveTextContent(/one room at a time/i);
        expect(screen.getByText(/single room for your whole party/i)).toBeInTheDocument();
    });
});
