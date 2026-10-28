/**
 * The flight checkout page after the card: driven as a traveller would, against a stubbed API
 * and a stubbed Stripe.
 *
 * The card is authorised before the airline is asked (the API's flight booking lifecycle), so
 * `/flights/confirm` can now answer three new ways: the airline has not settled it yet, the fare
 * rose, or it sold out — the last two with the hold already released. Each has to reach the
 * traveller as what it is, not as the same red sentence.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

// ── the world around the page ────────────────────────────────────────────────

let query = '';
const push = vi.fn();
const back = vi.fn();
const post = vi.fn();
const get = vi.fn();
const auth: { user: unknown; isLoading: boolean } = { user: { email: 'juan@example.com', first_name: '', last_name: '' }, isLoading: false };

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(query),
    useParams: () => ({}),
}));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => ({ push, back, replace: vi.fn() }),
}));
vi.mock('@/shared/lib/http', () => ({
    http: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) },
}));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => auth }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@/shared/components/common/CurrencySelector', () => ({ CurrencySelector: () => null }));

// Exchange rates, as the browser has them: none until they land. When they have, 1 USD is 1,400 KRW.
const rates = vi.hoisted(() => ({ live: false }));
vi.mock('@/shared/lib/currency', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/shared/lib/currency')>();
    return {
        ...real,
        ratesAreLive: () => rates.live,
        convertForDisplay: (amount: number, from: string, to: string) =>
            rates.live && from !== to ? { amount: amount * 1400, currency: to } : { amount, currency: from },
    };
});

// Stripe: a card form whose pay button authorises — manual capture, so `requires_capture`.
const stripeMock = vi.hoisted(() => ({ confirmPayment: vi.fn() }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(async () => ({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
    PaymentElement: ({ options }: { options?: { defaultValues?: { billingDetails?: { address?: { country?: string } } } } }) => (
        <div data-testid="payment-element" data-country={options?.defaultValues?.billingDetails?.address?.country} />
    ),
    useStripe: () => ({ confirmPayment: stripeMock.confirmPayment }),
    useElements: () => ({}),
}));

import CheckoutPage from '@/app/[locale]/checkout/page';

// Each test drives the whole page through its pickers — every click a full render — so the
// default 5s is too tight once the machine is busy.
vi.setConfig({ testTimeout: 20_000 });

// ── fixtures ─────────────────────────────────────────────────────────────────

const FLIGHT_QUERY = {
    offerId: 'off_1', origin: 'MNL', destination: 'NRT', departureDate: '2026-12-01',
    currency: 'USD', totalAmount: '250', adults: '1',
};

const httpError = (status: number, body: Record<string, unknown>) =>
    Object.assign(new Error((body.message as string) ?? 'x'), { status, code: body.error, body });

/** What `book` reports the card is held for: the fare above, plus the service fee. */
const HELD = { amount: 272.4, currency: 'USD', fare: 250, serviceFee: 22.4 };

type Confirm = () => unknown;
function api(confirm: Confirm = () => ({ bookingId: 'bk-1', pnr: 'ABC123', status: 'ticketed', source: 'lifecycle' })) {
    post.mockImplementation(async (path: string) => {
        if (path === '/flights/book') return { clientSecret: 'cs_1', sessionId: 'sess-1', paymentIntentId: 'pi_1', ...HELD };
        if (path === '/flights/confirm') return confirm();
        throw new Error(`unexpected POST ${path}`);
    });
}

/** What `GET /flights/offers/:offerId` answers — the confirmation screen's only source for
 *  terminals, airport names, duration and baggage; the URL carries none of it. */
const FLIGHT_OFFER = {
    offerId: 'off_1', provider: 'duffel',
    price: { total: 250, base: 250, taxes: 0, currency: 'USD', pricePerAdult: 250 },
    segments: [{
        segmentIndex: 0, airline: 'ZZ', airlineName: 'Duffel Airways', flightNumber: 'ZZ2200',
        origin: 'MNL', destination: 'NRT',
        departure: { airport: 'MNL', airportName: 'Ninoy Aquino International Airport', city: 'Manila', terminal: '2', time: '2026-12-01T13:56:00' },
        arrival:   { airport: 'NRT', airportName: 'Narita International Airport',       city: 'Tokyo',  terminal: '1', time: '2026-12-01T19:35:00' },
        duration: 279, stops: 0, cabinClass: 'economy',
    }],
    totalDuration: 279, sliceDurations: [279], totalStops: 0,
    refundable: true, farePolicy: { isRefundable: true, isChangeable: true, refundPenaltyAmount: null, refundPenaltyCurrency: null },
    baggage: { checkedBags: 1, cabinBag: true },
    normalizedPriceUsd: 250, bestScore: 0, physicalFlightId: 'off_1',
    quote: { currency: 'USD', fare: 250, serviceFee: 22.4, total: 272.4 },
};

function mockOffer(offer: unknown = FLIGHT_OFFER) {
    get.mockImplementation(async (path: string) => {
        if (path.split('?')[0] === '/flights/offers/off_1') return offer;
        throw new Error(`unexpected GET ${path}`);
    });
}

const renderPage = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><CheckoutPage /></NextIntlClientProvider>);

/** Fills passenger `n` (0-based) by the labels a traveller reads. Contact details are the lead's only. */
function fillPassenger(n = 0, dob = '1990-01-01', country = 'PH') {
    const type = (label: RegExp, value: string) =>
        fireEvent.change(screen.getAllByLabelText(label)[n], { target: { value } });
    type(/^first name/i, 'Juan');
    type(/^last name/i, 'Cruz');
    if (n === 0) {
        fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'juan@example.com' } });
        fireEvent.change(screen.getByLabelText(/^phone number/i), { target: { value: '9171234567' } });
    }
    pickDate(screen.getAllByLabelText(/^date of birth/i)[n], dob);
    fireEvent.click(screen.getAllByLabelText(/^gender/i)[n]);
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Male' }));
    type(/^passport number/i, 'P1234567');
    // In the month it opens on: valid on departure, one choice.
    pickDate(screen.getAllByLabelText(/^passport expiry/i)[n], '2026-12-20');
    fireEvent.click(screen.getAllByLabelText(/^country/i)[n]);
    fireEvent.change(screen.getAllByLabelText(/^country/i)[n], {
        target: { value: country === 'PH' ? 'Philippines' : 'United States' },
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: new RegExp(`\\(${country}\\)$`, 'i') }));
}

/** Picks `iso` in a date field the way a traveller does: open it, then year, month, day. */
function pickDate(trigger: HTMLElement, iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    fireEvent.click(trigger);
    const panel = within(screen.getByRole('dialog'));
    const dayName = date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' });
    const onShow = panel.queryByRole('button', { name: dayName });
    if (onShow) { fireEvent.click(onShow); return; }
    // Climb to the years, from wherever it opened.
    const up = (name: string) => { const b = panel.queryByRole('button', { name }); if (b) fireEvent.click(b); };
    up('Choose year and month');
    up('Choose year');
    fireEvent.click(panel.getByRole('button', { name: String(y) }));
    fireEvent.click(panel.getByRole('button', { name: date.toLocaleDateString('en', { month: 'long', year: 'numeric' }) }));
    fireEvent.click(panel.getByRole('button', { name: date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' }) }));
}

/** Details, then the card. */
async function payForFlight() {
    renderPage();
    fillPassenger();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pay usd 272\.40/i }));
}

const confirmCalls = () => post.mock.calls.filter((c) => c[0] === '/flights/confirm');

beforeEach(() => {
    vi.clearAllMocks();
    rates.live = false;
    stripeMock.confirmPayment.mockImplementation(async () => ({ paymentIntent: { id: 'pi_1', status: 'requires_capture' } }));
    auth.user = { email: 'juan@example.com', first_name: '', last_name: '' };
    query = new URLSearchParams(FLIGHT_QUERY).toString();
    api();
    mockOffer();
});

// ── the tests ────────────────────────────────────────────────────────────────

interface BookBody {
    confirmedPrice?: number;
    displayCurrency?: string;
    idempotencyKey?: string;
    contact:    { email: string; phone: string; countryCode: string };
    passengers: Array<{ type: string; dateOfBirth: string; nationality: string }>;
}
const bookCalls = () => post.mock.calls.filter((c) => c[0] === '/flights/book').map((c) => c[1] as BookBody);

describe('the page, in the checkout\'s own design', () => {
    it('has the checkout\'s heading and steps, and its "Continue to payment" action', () => {
        renderPage();
        expect(screen.getByRole('heading', { level: 1, name: 'Complete your booking' })).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeInTheDocument();
    });

    it('asks a signed-out traveller to sign in, in the page\'s language', () => {
        auth.user = null;
        renderPage();
        expect(screen.getByText('Sign in to complete your booking')).toBeInTheDocument();
    });

    it('fills the main action and the current step with the brand gradient', () => {
        const { container } = renderPage();
        expect(screen.getByRole('button', { name: 'Continue to payment' }).getAttribute('style')).toMatch(/linear-gradient/);
        // The step in hand is the one thumb that slides between the discs, so it carries the fill.
        expect(container.querySelector('.cg-steps-thumb')?.getAttribute('style')).toMatch(/linear-gradient/);
    });

    it('rings the fields in the brand gradient, and haloes the one being typed in', () => {
        const { container } = renderPage();
        const field = container.querySelector('input.cg-field');
        // blue-600 → cyan-500, as jsdom writes them back.
        expect(field?.getAttribute('style')).toMatch(/linear-gradient\(90deg, rgb\(37, 99, 235\) 0%, rgb\(6, 182, 212\) 100%\) border-box/);
        const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('\n');
        expect(css).toMatch(/\.cg-field:focus,\.cg-phone:focus-within\{box-shadow:0 0 0 4px rgba\(59,130,246,0\.18\)\}/);
    });

    it('keeps a field\'s edge and fill when the browser autofills it', () => {
        // Chrome sets `background-image: none !important` on an autofilled input, and the ring
        // and the white fill are both background images — so an autofilled field lost its pill.
        // Border colour and an inset shadow are not touched by that rule, so they put it back.
        const { container } = renderPage();
        const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('\n');
        expect(css).toMatch(/\.cg-field:-webkit-autofill[^}]*border-color:var\(--cg-ring,[^)]*\) !important/);
        expect(css).toMatch(/\.cg-field:-webkit-autofill[^}]*box-shadow:0 0 0 1000px #ffffff inset/);
        // The colour it falls back to is the field's own: blue, or red once it is wrong.
        const field = container.querySelector('input.cg-field') as HTMLElement;
        expect(field.style.getPropertyValue('--cg-ring')).toBe('#3b82f6');
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        expect((container.querySelector('input.cg-field') as HTMLElement).style.getPropertyValue('--cg-ring')).toBe('#E4685A');
    });

    it('writes the confirmation in the theme\'s ink — not white on the light theme\'s white', async () => {
        await payForFlight();
        const heading = await screen.findByText('You\u2019re all set');
        // The brand's slate-900.
        expect(heading).toHaveStyle({ color: 'rgb(15, 23, 42)' });
    });
});

describe('the passenger form', () => {
    it('labels every field, so two blank dates are not a guess', () => {
        renderPage();
        for (const label of [/^first name/i, /^last name/i, /^email/i, /^phone number/i, /^date of birth/i,
            /^gender/i, /^passport number/i, /^passport expiry/i, /^country/i]) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
        for (const field of [/^first name/i, /^last name/i, /^email/i, /^phone number/i, /^passport number/i]) {
            expect(screen.getByLabelText(field)).toHaveAttribute('placeholder');
        }
        expect(screen.getByLabelText(/^country/i)).toHaveAttribute('role', 'combobox');
        expect(screen.getByLabelText(/^country/i)).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('marks every field required, and says so to a screen reader where it can', () => {
        renderPage();
        // Each caption carries the " *", whether its text does or the page adds it.
        for (const label of [/^first name/i, /^last name/i, /^email/i, /^phone number/i, /^date of birth/i,
            /^gender/i, /^passport number/i, /^passport expiry/i, /^country/i]) {
            expect(screen.getByText(label, { selector: 'label' }).textContent).toMatch(/\*$/);
        }
        for (const field of [/^first name/i, /^last name/i, /^email/i, /^phone number/i, /^passport number/i]) {
            expect(screen.getByLabelText(field)).toHaveAttribute('aria-required', 'true');
        }
    });

    it('refuses to continue until every field is filled, and names each one that is empty', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        // First and last name, email, phone, birth date, gender, passport number and expiry, country.
        expect(screen.getAllByText('Required')).toHaveLength(8);
        expect(screen.getByText('2-letter country code')).toBeInTheDocument();
        expect(post.mock.calls.filter((c) => c[0] === '/flights/book')).toHaveLength(0);
    });

    it('shows the email and phone fields with an example too, like the names', () => {
        renderPage();
        expect(screen.getByLabelText(/^email/i)).toHaveAttribute('placeholder', 'eg.johndoe@gmail.com');
        expect(screen.getByLabelText(/^phone number/i)).toHaveAttribute('placeholder', '912 345 6789');
    });

    it('shows the name fields with an example name, not their own labels again', () => {
        // The one example person every booking form uses, split across the two fields so the
        // first-name box is not read as asking for a full name.
        renderPage();
        expect(screen.getByLabelText(/^first name/i)).toHaveAttribute('placeholder', 'John');
        expect(screen.getByLabelText(/^last name/i)).toHaveAttribute('placeholder', 'Doe');
    });

    it('opens every picker — date, gender, country autocomplete and dial code — in the same panel', () => {
        renderPage();
        const panelOf = (el: HTMLElement) => el.closest('.cg-picker-panel');

        fireEvent.click(screen.getByLabelText(/^gender/i));
        expect(panelOf(screen.getByRole('listbox'))).not.toBeNull();
        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

        fireEvent.click(screen.getByLabelText(/^country/i));
        expect(panelOf(screen.getByRole('listbox'))).not.toBeNull();
        expect(within(screen.getByRole('listbox')).getByRole('option', { name: /United States \(US\)/i })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/^country/i), { target: { value: 'United States' } });
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

        fireEvent.click(screen.getByRole('button', { name: '+63' }));
        expect(panelOf(screen.getByRole('listbox'))).not.toBeNull();
        fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

        fireEvent.click(screen.getByLabelText(/^date of birth/i));
        expect(screen.getByRole('dialog').classList.contains('cg-picker-panel')).toBe(true);
    });

    it('asks for gender with the checkout\'s own dropdown, not the browser\'s', () => {
        const { container } = renderPage();
        expect(container.querySelector('select')).toBeNull();
        expect(screen.getByLabelText(/^gender/i)).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('asks for dates with the checkout\'s own picker, not the browser\'s', () => {
        const { container } = renderPage();
        expect(container.querySelector('input[type="date"]')).toBeNull();
        expect(screen.getByLabelText(/^date of birth/i)).toHaveAttribute('aria-haspopup', 'dialog');
        expect(screen.getByLabelText(/^passport expiry/i)).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('offers an adult only birthdays that make them twelve or over on the day they fly', () => {
        renderPage();
        // Departs 2026-12-01: the youngest adult was born on 2014-12-01.
        fireEvent.click(screen.getByLabelText(/^date of birth/i));
        const panel = within(screen.getByRole('dialog'));
        // Opens around a likely adult birth year; the latest years are two pages on.
        fireEvent.click(panel.getByRole('button', { name: 'Later years' }));
        fireEvent.click(panel.getByRole('button', { name: 'Later years' }));
        expect(panel.getByRole('button', { name: '2014' })).toBeEnabled();
        expect(panel.getByRole('button', { name: '2015' })).toBeDisabled();
        expect(panel.getByRole('button', { name: 'Later years' })).toBeDisabled();
    });

    it('offers only passports still valid on the day they fly', () => {
        renderPage();
        fireEvent.click(screen.getByLabelText(/^passport expiry/i));
        const panel = within(screen.getByRole('dialog'));
        expect(panel.getByText('December 2026')).toBeInTheDocument();
        expect(panel.getByRole('button', { name: 'December 1, 2026' })).toBeEnabled();
        // Nothing before the departure month is on offer.
        expect(panel.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    });

    it('sends the mobile number with the country code chosen beside it', async () => {
        renderPage();
        fillPassenger();
        // Without a code the API reads a national number as Korean: 0917… became +82917….
        fireEvent.click(screen.getByRole('button', { name: '+63' }));
        fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /south korea/i }));
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        await waitFor(() => expect(bookCalls()).toHaveLength(1));
        expect(bookCalls()[0].contact).toEqual({ email: 'juan@example.com', phone: '9171234567', countryCode: '+82' });
    });

    it('defaults the country code to the Philippines', async () => {
        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        await waitFor(() => expect(bookCalls()).toHaveLength(1));
        expect(bookCalls()[0].contact.countryCode).toBe('+63');
    });

    it('prefills Stripe billing country from the booking form country', async () => {
        renderPage();
        fillPassenger(0, '1990-01-01', 'US');
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        expect(await screen.findByTestId('payment-element')).toHaveAttribute('data-country', 'US');
        expect(bookCalls()[0].passengers[0].nationality).toBe('US');
    });

    it('asks for every traveller the fare was priced for, in the airline\'s order, and contact details once', async () => {
        query = new URLSearchParams({ ...FLIGHT_QUERY, adults: '1', children: '1', infants: '1' }).toString();
        renderPage();

        expect(screen.getByText('ADULT 1')).toBeInTheDocument();
        expect(screen.getByText('CHILD 1')).toBeInTheDocument();
        expect(screen.getByText('INFANT 1')).toBeInTheDocument();
        expect(screen.getAllByLabelText(/^email/i)).toHaveLength(1);
        expect(screen.getAllByLabelText(/^phone number/i)).toHaveLength(1);

        fillPassenger(0);
        fillPassenger(1, '2018-05-05');
        fillPassenger(2, '2026-03-01');
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        await waitFor(() => expect(bookCalls()).toHaveLength(1));
        expect(bookCalls()[0].passengers.map((p) => p.type)).toEqual(['ADT', 'CHD', 'INF']);
        expect(bookCalls()[0].passengers.map((p) => p.dateOfBirth))
            .toEqual(['1990-01-01', '2018-05-05', '2026-03-01']);
        expect(bookCalls()[0].passengers.map((p) => p.nationality)).toEqual(['PH', 'PH', 'PH']);
    // Three travellers' forms, six date pickers, each click a full page render: about nine
    // seconds on its own, so twenty was not enough once the whole suite ran beside it.
    }, 40_000);
});

describe('moving between the steps', () => {
    const thumbStep = (container: HTMLElement) =>
        (container.querySelector('ol') as HTMLElement).style.getPropertyValue('--step-idx');

    it('marks the step in hand with one thumb that slides, not a fill that swaps', async () => {
        const { container } = renderPage();
        expect(thumbStep(container)).toBe('0');
        expect(container.querySelectorAll('.cg-steps-thumb')).toHaveLength(1);

        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        await screen.findByRole('button', { name: /pay usd 272\.40/i });

        expect(thumbStep(container)).toBe('1');
        expect(container.querySelector('li[aria-current="step"]')).toHaveTextContent('Payment');
        // Only the numeral of the step in hand is white; the others keep the ink.
        const numerals = Array.from(container.querySelectorAll('.cg-steps-num')) as HTMLElement[];
        expect(numerals.map((n) => n.style.color)).toEqual([expect.not.stringMatching(/255, 255, 255/), 'rgb(255, 255, 255)', expect.not.stringMatching(/255, 255, 255/)]);
    });

    it('does not animate on arrival, slides in from the right going forward and from the left going back', async () => {
        const { container } = renderPage();
        expect(container.querySelector('[class*="cg-slide-"]')).toBeNull();

        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        await screen.findByRole('button', { name: /pay usd 272\.40/i });
        expect(container.querySelectorAll('.cg-slide-forward').length).toBeGreaterThan(0);
        expect(container.querySelector('.cg-slide-back')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /back to booking details/i }));
        await screen.findByRole('button', { name: /continue to payment/i });
        expect(container.querySelectorAll('.cg-slide-back').length).toBeGreaterThan(0);
        expect(container.querySelector('.cg-slide-forward')).toBeNull();
    });
});

describe('the payment step', () => {
    it('says the card is held now and charged only when the airline confirms', async () => {
        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        expect(await screen.findByText(/charged only once the airline confirms your ticket/i)).toBeInTheDocument();
    });

    it('asks Stripe to authorise the card once, however often Pay is pressed while it works', async () => {
        // Authorising takes a round trip to the bank, and longer with a 3-D Secure challenge.
        // The page's own busy flag only goes up once Stripe has answered, so until then nothing
        // stood between a second press and a second authorisation of the same payment.
        let authorise!: (result: unknown) => void;
        stripeMock.confirmPayment.mockImplementation(() => new Promise((resolve) => { authorise = resolve; }));

        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        const pay = await screen.findByRole('button', { name: /pay usd 272\.40/i });

        fireEvent.click(pay);
        fireEvent.click(pay);

        expect(stripeMock.confirmPayment).toHaveBeenCalledTimes(1);
        expect(pay).toBeDisabled();

        await act(async () => { authorise({ paymentIntent: { id: 'pi_1', status: 'requires_capture' } }); });
        await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    });

    it('lets the traveller try again when the card is declined', async () => {
        stripeMock.confirmPayment.mockResolvedValueOnce({ error: { message: 'Your card was declined.' } });

        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
        fireEvent.click(await screen.findByRole('button', { name: /pay usd 272\.40/i }));

        expect(await screen.findByText('Your card was declined.')).toBeInTheDocument();
        const again = screen.getByRole('button', { name: /pay usd 272\.40/i });
        expect(again).toBeEnabled();

        fireEvent.click(again);
        await waitFor(() => expect(confirmCalls()).toHaveLength(1));
    });
});

describe('what the traveller is shown, and what the card is held for', () => {
    it('shows one fare with the service fee folded into it, and the total — the quote the server made — before any details are entered', async () => {
        renderPage();

        // Together, and re-queried: the summary is rebuilt as the page settles after the quote
        // arrives, so an element held across that would be a detached one.
        await waitFor(() => {
            // The fare line and the total: 250.00 + 22.40, as one figure each.
            expect(screen.getAllByText('USD 272.40')).toHaveLength(2);
        });
        expect(screen.queryByText('Service fee')).not.toBeInTheDocument();
        expect(screen.queryByText('USD 22.40')).not.toBeInTheDocument();
        expect(screen.queryByText('USD 250.00')).not.toBeInTheDocument();
    });

    it('names each end by its full airport name and code, with the day and the clock', async () => {
        renderPage();

        // Together, and re-queried, for the reason the quote test above gives.
        await waitFor(() => {
            expect(screen.getByText('Ninoy Aquino International Airport (MNL)')).toBeInTheDocument();
            expect(screen.getByText('Narita International Airport (NRT)')).toBeInTheDocument();
            // Local Airport Time as the airline quoted it: the digits are not shifted to a zone.
            expect(screen.getByText('Tue, Dec 1, 2026, 13:56')).toBeInTheDocument();
            expect(screen.getByText('Tue, Dec 1, 2026, 19:35')).toBeInTheDocument();
        });
    });

    it('falls back to the fare in the link, with no invented fee, when no quote could be made', async () => {
        get.mockRejectedValue(new Error('airline unreachable'));
        renderPage();

        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(screen.queryByText('Service fee')).not.toBeInTheDocument();
        expect(screen.getByText('USD 250')).toBeInTheDocument();
    });

    it('asks the server to hold the card only if the fare is still the one that was shown', async () => {
        // The web checkout sent no fare to compare, so a fare that rose between the search and
        // the card was never caught here and went on to be refused after the card.
        renderPage();
        await waitFor(() => expect(screen.getAllByText('USD 272.40')).toHaveLength(2));
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        await waitFor(() => expect(bookCalls()).toHaveLength(1));
        expect(bookCalls()[0].confirmedPrice).toBe(250);
    });

    describe('the currency selector', () => {
        // The selector rewrites `?currency=`; everything priced on the page has to follow it. The
        // link's own pair — `totalAmount` 250, `currency` USD — is the airline's, and stays so.
        const PHP_OFFER = { ...FLIGHT_OFFER, quote: { currency: 'PHP', fare: 14500, serviceFee: 1600, total: 16100 } };
        const withCurrency = (currency: string) => new URLSearchParams({ ...FLIGHT_QUERY, currency }).toString();
        // A fresh element each time: React skips re-rendering the very same one, and the query it
        // reads has changed underneath it.
        const page = () => <NextIntlClientProvider locale="en" messages={en as never}><CheckoutPage /></NextIntlClientProvider>;

        /** An offer that quotes in the currency it is asked for. */
        function mockOfferByCurrency() {
            get.mockImplementation(async (path: string) => {
                const [route, qs] = path.split('?');
                if (route !== '/flights/offers/off_1') throw new Error(`unexpected GET ${path}`);
                return new URLSearchParams(qs).get('currency') === 'PHP' ? PHP_OFFER : FLIGHT_OFFER;
            });
        }

        it('asks for the quote in the currency the page is in', async () => {
            query = withCurrency('PHP');
            renderPage();
            await waitFor(() => expect(get).toHaveBeenCalledWith('/flights/offers/off_1?currency=PHP'));
        });

        it('quotes again when another currency is picked, and shows that quote instead', async () => {
            mockOfferByCurrency();
            const view = render(page());
            await waitFor(() => expect(screen.getAllByText('USD 272.40')).toHaveLength(2));

            query = withCurrency('PHP');
            view.rerender(page());

            await waitFor(() => expect(screen.getAllByText('PHP 16,100.00')).toHaveLength(2));
            expect(screen.queryByText('USD 272.40')).not.toBeInTheDocument();
        });

        it('does not rename the link\'s fare as the new currency while there is no quote in it', async () => {
            // 250 is a USD figure. Under PHP it would be read as ₱250 — a fare of about four dollars.
            get.mockRejectedValue(new Error('airline unreachable'));
            const view = render(page());
            // Re-queried: the summary is rebuilt as the page settles, so a held element goes stale.
            await waitFor(() => expect(screen.getByText('USD 250')).toBeInTheDocument());

            query = withCurrency('PHP');
            view.rerender(page());

            await waitFor(() => expect(screen.getByText('USD 250')).toBeInTheDocument());
            expect(screen.queryByText('PHP 250')).not.toBeInTheDocument();
        });

        describe('while it is still being read', () => {
            /** A GET that answers when the test says so. */
            function deferred() {
                let resolve!: (v: unknown) => void;
                const promise = new Promise<unknown>((r) => { resolve = r; });
                return { promise, resolve };
            }
            const bones = (root: ParentNode = document) => root.querySelectorAll('.cg-skeleton');

            it('draws the itinerary and the amounts as skeleton until the offer arrives', async () => {
                const offer = deferred();
                get.mockImplementation(() => offer.promise);
                renderPage();

                expect(bones().length).toBeGreaterThan(0);
                expect(screen.queryByText('Ninoy Aquino International Airport (MNL)')).not.toBeInTheDocument();
                // The amounts are not guessed at meanwhile — not the link's 250 under the quote's name.
                expect(screen.queryByText('USD 250')).not.toBeInTheDocument();

                await act(async () => { offer.resolve(FLIGHT_OFFER); });

                await waitFor(() => expect(screen.getAllByText('USD 272.40')).toHaveLength(2));
                expect(bones()).toHaveLength(0);
                expect(screen.getByText('Ninoy Aquino International Airport (MNL)')).toBeInTheDocument();
            });

            it('draws the amounts as skeleton while a new currency is quoted — and not the old currency\'s figures', async () => {
                const php = deferred();
                get.mockImplementation(async (path: string) => (path.includes('currency=PHP') ? php.promise : FLIGHT_OFFER));
                const view = render(page());
                await waitFor(() => expect(screen.getAllByText('USD 272.40')).toHaveLength(2));
                expect(bones()).toHaveLength(0);

                query = withCurrency('PHP');
                view.rerender(page());

                await waitFor(() => expect(bones().length).toBeGreaterThan(0));
                expect(screen.queryByText('USD 272.40')).not.toBeInTheDocument();
                // What was already read stays: only the figures wait.
                await waitFor(() => expect(screen.getByText('Ninoy Aquino International Airport (MNL)')).toBeInTheDocument());

                await act(async () => { php.resolve(PHP_OFFER); });
                await waitFor(() => expect(screen.getAllByText('PHP 16,100.00')).toHaveLength(2));
                expect(bones()).toHaveLength(0);
            });

            it('stops drawing skeleton when the offer cannot be read, and falls back to the link\'s fare', async () => {
                get.mockRejectedValue(new Error('airline unreachable'));
                renderPage();
                await waitFor(() => expect(screen.getByText('USD 250')).toBeInTheDocument());
                expect(bones()).toHaveLength(0);
            });

            it('draws the receipt\'s flight details as skeleton until the offer arrives', async () => {
                const offer = deferred();
                get.mockImplementation(() => offer.promise);
                await payForFlight();
                await screen.findByText('You\u2019re all set');

                expect(bones().length).toBeGreaterThan(0);
                expect(screen.queryByText('Duffel Airways')).not.toBeInTheDocument();

                await act(async () => { offer.resolve(FLIGHT_OFFER); });
                expect(await screen.findByText('Duffel Airways')).toBeInTheDocument();
                expect(bones()).toHaveLength(0);
            });
        });

        it('reads the link’s fare in the currency the link names for it, when the page opens in another', async () => {
            // From the results page: opens in the traveller's KRW, with the airline's 250 still USD.
            get.mockRejectedValue(new Error('airline unreachable'));
            query = new URLSearchParams({ ...FLIGHT_QUERY, currency: 'KRW', fareCurrency: 'USD' }).toString();
            renderPage();
            await waitFor(() => expect(screen.getByText('USD 250')).toBeInTheDocument());
            expect(screen.queryByText('KRW 250')).not.toBeInTheDocument();
        });

        it('holds the card in the currency on show, against the airline\'s own fare — not the converted one', async () => {
            mockOfferByCurrency();
            query = withCurrency('PHP');
            renderPage();
            await waitFor(() => expect(screen.getAllByText('PHP 16,100.00')).toHaveLength(2));
            fillPassenger();
            fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

            await waitFor(() => expect(bookCalls()).toHaveLength(1));
            expect(bookCalls()[0].displayCurrency).toBe('PHP');
            // `confirmedPrice` is compared with the airline's fare in the airline's currency; 14,500
            // against 250 USD would be refused as a price rise that never happened.
            expect(bookCalls()[0].confirmedPrice).toBe(250);
        });

        it('makes a different currency a different attempt, so a hold in the first is not handed back', async () => {
            query = withCurrency('PHP');
            renderPage();
            fillPassenger();
            fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

            await waitFor(() => expect(bookCalls()).toHaveLength(1));
            expect(bookCalls()[0].idempotencyKey).toMatch(/PHP$/);
        });
    });

    it('still sends the fare it was linked with when there is no quote', async () => {
        get.mockRejectedValue(new Error('airline unreachable'));
        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        await waitFor(() => expect(bookCalls()).toHaveLength(1));
        expect(bookCalls()[0].confirmedPrice).toBe(250);
    });

    it('writes on the Pay button what the server says the card is held for, to the cent — not the fare in the link', async () => {
        api(() => ({ bookingId: 'bk-1', pnr: 'ABC123', status: 'ticketed' }));
        post.mockImplementation(async (path: string) => {
            if (path === '/flights/book') return { clientSecret: 'cs_1', sessionId: 'sess-1', paymentIntentId: 'pi_1', amount: 281.93, currency: 'USD', fare: 258, serviceFee: 23.93 };
            throw new Error(`unexpected POST ${path}`);
        });

        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        expect(await screen.findByRole('button', { name: /pay usd 281\.93/i })).toBeInTheDocument();
    });

    it('tells the traveller the fare rose, with both prices, before any card is held', async () => {
        post.mockImplementation(async (path: string) => {
            if (path === '/flights/book') {
                throw httpError(409, { error: 'PRICE_CHANGED', message: 'Flight price changed from 250 to 270. Please restart booking.', oldPrice: 250, newPrice: 270, currency: 'USD' });
            }
            throw new Error(`unexpected POST ${path}`);
        });

        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

        expect(await screen.findByText(/price changed from 250 to 270/i)).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    });
});

describe('after the card', () => {
    it('confirms the booking it was told about', async () => {
        await payForFlight();

        await waitFor(() => expect(confirmCalls()).toHaveLength(1));
        expect(confirmCalls()[0][1]).toEqual({ paymentIntentId: 'pi_1', sessionId: 'sess-1' });
        expect(await screen.findByText('bk-1')).toBeInTheDocument();
    });

    it('gives a flight receipt — the itinerary, the passenger, the airline reference and the fare paid — not a hotel stay', async () => {
        // An account email that is not the contact's, so the receipt line has to name the
        // address the e-ticket goes to.
        auth.user = { email: 'account@example.com', first_name: '', last_name: '' };
        await payForFlight();

        expect(await screen.findByText('You\u2019re all set')).toBeInTheDocument();
        // Itinerary detail only the GET /flights/offers/:offerId fetch carries — wait for it.
        expect(await screen.findByText('Duffel Airways')).toBeInTheDocument();

        // One sentence: where the flight goes, and the contact's address — not the signed-in account's.
        expect(screen.getByText(/Your flight to Tokyo is confirmed, flight details and receipt has been sent to juan@example\.com/)).toBeInTheDocument();
        expect(screen.queryByText(/account@example\.com/)).not.toBeInTheDocument();

        // The flight itself: each end by its airport's full name and code, the day and the
        // clock — in the reader's own convention, the airport's own digits.
        expect(screen.getByText('Depart From')).toBeInTheDocument();
        expect(screen.getByText('Arrive At')).toBeInTheDocument();
        expect(screen.getByText('Ninoy Aquino International Airport (MNL)')).toBeInTheDocument();
        expect(screen.getByText('Narita International Airport (NRT)')).toBeInTheDocument();
        expect(screen.getByText('Tue, Dec 1, 2026, 1:56 PM')).toBeInTheDocument();
        expect(screen.getByText('Tue, Dec 1, 2026, 7:35 PM')).toBeInTheDocument();
        expect(screen.getByText(/ZZ2200/)).toBeInTheDocument();
        expect(screen.getByText(/ABC123/)).toBeInTheDocument(); // the airline's own PNR
        expect(screen.getByText('Terminal 2')).toBeInTheDocument();
        expect(screen.getByText('Terminal 1')).toBeInTheDocument();
        expect(screen.getByText('Refundable (fees may apply)')).toBeInTheDocument();
        expect(screen.getByText(/1 carry-on bag/)).toBeInTheDocument();
        expect(screen.getByText(/1 checked bag/)).toBeInTheDocument();

        // The passenger, and what was paid: one fare, the service fee inside it.
        expect(screen.getByText('Juan Cruz')).toBeInTheDocument();
        expect(screen.getByText('ADULT 1')).toBeInTheDocument();
        expect(screen.getByText('Payment Summary')).toBeInTheDocument();
        expect(screen.getAllByText('USD 272.40')).toHaveLength(2);    // the fare line and what the card was held for
        expect(screen.queryByText('USD 22.40')).not.toBeInTheDocument();
        expect(screen.queryByText('USD 250.00')).not.toBeInTheDocument();
        expect(screen.queryByText('Service fee')).not.toBeInTheDocument();
        expect(screen.getByText('bk-1')).toBeInTheDocument();

        // What a flight used to be told it had booked.
        expect(screen.queryByText('Hotel')).not.toBeInTheDocument();
        expect(screen.queryByText('Standard Room')).not.toBeInTheDocument();
        expect(screen.queryByText('USD 0')).not.toBeInTheDocument();
    });

    it('keeps "Total paid" in the currency the card was charged in, and adds what it comes to in the one picked', async () => {
        rates.live = true;                       // the store's currency is KRW
        await payForFlight();
        await screen.findByText('You\u2019re all set');

        // What was charged does not move with the selector — that is the receipt's fact.
        expect(screen.getAllByText('USD 272.40')).toHaveLength(2);
        // The selector's currency gets an estimate beside it: 272.40 × 1,400.
        expect(screen.getByText('Approx. in KRW')).toBeInTheDocument();
        expect(screen.getByText('\u2248 KRW 381,360')).toBeInTheDocument();
    });

    it('leaves the estimate out until the rates are live, rather than inventing a figure', async () => {
        await payForFlight();
        await screen.findByText('You\u2019re all set');

        expect(screen.queryByText(/^Approx\. in/)).not.toBeInTheDocument();
    });

    it('labels the trips button "View Bookings" on the flight receipt', async () => {
        await payForFlight();
        await screen.findByText('You\u2019re all set');

        fireEvent.click(screen.getByRole('button', { name: 'View Bookings' }));
        expect(push).toHaveBeenCalledWith('/trips');
    });

    it('keeps the toolbar above the receipt: back to where the traveller came from, and the theme switch', async () => {
        await payForFlight();
        await screen.findByText('You\u2019re all set');

        // Back goes to the previous page, not home — the receipt is somewhere you came to, not a dead end.
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
        expect(back).toHaveBeenCalledTimes(1);
        expect(push).not.toHaveBeenCalledWith('/');

        expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    });

    it('shows a booking the airline has not settled yet as one being confirmed, with the way to their trips', async () => {
        api(() => { throw httpError(409, { error: 'BOOKING_PROCESSING', message: 'Still confirming.', pending: true, needsReview: false, sessionId: 'sess-1' }); });

        await payForFlight();

        expect(await screen.findByText(/the airline is confirming your ticket/i)).toBeInTheDocument();
        expect(screen.getByText(/don't pay again/i)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /view my trips/i }));
        expect(push).toHaveBeenCalledWith('/trips');
    });

    it('says a confirmation that never got an answer is still being confirmed — never that it failed', async () => {
        // The airline can take longer to answer than a proxy waits. By then the ticket may be
        // issued and the card captured, so the traveller must not be told to try again.
        api(() => { throw new TypeError('Failed to fetch'); });

        await payForFlight();

        expect(await screen.findByText(/the airline is confirming your ticket/i)).toBeInTheDocument();
        expect(screen.getByText(/don't pay again/i)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByText(/contact support/i)).not.toBeInTheDocument();
    });

    it('says a person is finishing it when it is under review — and never that the card was not charged', async () => {
        api(() => { throw httpError(409, { error: 'BOOKING_PROCESSING', message: 'Being confirmed.', pending: true, needsReview: true }); });

        await payForFlight();

        expect(await screen.findByText(/we're confirming this with the airline/i)).toBeInTheDocument();
        expect(screen.queryByText(/not been charged|hasn't been taken/i)).not.toBeInTheDocument();
    });

    it('says the fare rose, with both prices, that nothing was charged, and goes back to the details', async () => {
        api(() => { throw httpError(409, { error: 'PRICE_CHANGED', message: 'x', oldPrice: 100, newPrice: 140, currency: 'USD' }); });

        await payForFlight();

        expect(await screen.findByText(/changed from USD 100 to USD 140/i)).toBeInTheDocument();
        expect(screen.getByText(/hold on your card has been released/i)).toBeInTheDocument();
        // The PaymentIntent behind the card form was voided: there is nothing left to pay with.
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue to payment/i })).toBeInTheDocument();
    });

    it('says the fare sold out, that nothing was charged, and goes back to the details', async () => {
        api(() => { throw httpError(410, { error: 'OFFER_EXPIRED', message: 'x' }); });

        await payForFlight();

        expect(await screen.findByText(/sold out before the airline could confirm it/i)).toBeInTheDocument();
        expect(screen.getByText(/hold on your card has been released/i)).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    });

    it('relays any other refusal in the server\'s words, and goes back to the details', async () => {
        api(() => { throw httpError(400, { error: 'DUFFEL_ORDER_FAILED', message: 'Passenger name is invalid. Your card has not been charged.' }); });

        await payForFlight();

        expect(await screen.findByText('Passenger name is invalid. Your card has not been charged.')).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    });
});
