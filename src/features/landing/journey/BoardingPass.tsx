'use client';

import { Link } from '@/i18n/navigation';
import { BRAND } from '@/shared/lib/palette';
import { Barcode, TicketStub } from '@/shared/components/ui/ticket-stub';
import { hotelSearchUrl, type TripDates } from '@/features/landing/lib/links';
import { STAGES, hasWritten, ramp, type StageId } from './stages';
import type { PassState } from './passState';

export type { PassState };

/** One written row. Rendered in stage order, never ahead of the descent. */
function PassLine({ label, value, written }: { label: string; value: string; written: boolean }) {
    return (
        <div
            className="flex items-baseline justify-between gap-4 py-2 transition-[opacity,transform] duration-500"
            style={{
                opacity: written ? 1 : 0.18,
                // Lines slide a few pixels as they land. Enough to notice arriving,
                // not enough to make a settled pass look restless.
                transform: written ? 'translateY(0)' : 'translateY(4px)',
            }}
        >
            <span className="text-[10px] tracking-[0.18em] text-white/45 uppercase">{label}</span>
            <span className="truncate text-sm font-medium text-white">{written ? value : '—'}</span>
        </div>
    );
}

/**
 * The Boarding Pass: the Journey's one piece of accumulating state.
 *
 * It docks rather than scrolls, and fills a line per Stage as the visitor descends. The
 * button at the end runs exactly the search the pass describes — which is what separates
 * this from a decorative graphic, and why the fields below are real search params rather
 * than display strings.
 *
 * Hidden on small screens: a docked panel plus a docked search form is more than a phone
 * viewport can hold, and the search is the thing that must survive.
 */
export function BoardingPass({
    journey,
    pass,
    dates,
    side = 'right',
}: {
    journey: number;
    pass: PassState;
    dates: TripDates;
    /** Opposite the docked stage, so the pass and the search never share an edge. */
    side?: 'left' | 'right';
}) {
    // Arrives with the first stage, never before: there is nothing to show against the
    // hero, and a pass docked over the headline is a panel with no reason to exist yet.
    const opacity = ramp(journey, 0.10, 0.16);
    if (opacity <= 0.01) return null;

    const stage = (id: StageId) => STAGES.find(s => s.id === id)!;
    const staysWritten = hasWritten(stage('stays'), journey);
    const flightsWritten = hasWritten(stage('flights'), journey);
    const aiWritten = hasWritten(stage('ai'), journey);

    // The visitor's own dates when they have picked any, the suggested ones otherwise —
    // so the search this opens is the stay the card is describing, not a different one.
    const href = hotelSearchUrl({
        destination: pass.destination,
        checkIn: pass.checkIn ?? dates.depart,
        checkOut: pass.checkOut ?? dates.ret,
        countryCode: pass.countryCode || undefined,
    });

    return (
        <aside
            aria-label="Your trip so far"
            className={`pointer-events-none fixed top-1/2 z-20 hidden w-[19rem] -translate-y-1/2 transition-[left,right] duration-700 lg:block ${
                side === 'left' ? 'left-[max(1rem,4vw)]' : 'right-[max(1rem,4vw)]'
            }`}
            style={{ opacity }}
        >
            <div
                className="pointer-events-auto overflow-hidden rounded-2xl backdrop-blur-md"
                style={{ background: 'rgba(2,6,23,0.72)', border: `1px solid ${BRAND.glassBorder}` }}
            >
                <div className="flex items-center justify-between px-5 pt-4">
                    <span className="text-[10px] tracking-[0.28em] text-white/50 uppercase">
                        CheapestGo
                    </span>
                    <span className="text-[10px] tracking-[0.18em] text-white/35 uppercase">
                        {pass.touched ? 'Your trip' : 'Suggested'}
                    </span>
                </div>

                <div className="divide-y divide-white/5 px-5 pb-1">
                    <PassLine
                        label="Staying"
                        value={`${pass.destination} · ${pass.nights} nights`}
                        written={staysWritten}
                    />
                    <PassLine label="Flying" value={pass.route ?? ''} written={flightsWritten && !!pass.route} />
                    <PassLine label="Planned by" value={pass.aiNote ?? ''} written={aiWritten && !!pass.aiNote} />
                </div>

                <div className="px-5">
                    <Barcode className="my-3 opacity-70" />
                </div>

                {/* Live only once the descent has written something worth running. Before
                    that it would send the visitor to a search for a city they never chose. */}
                <div className="px-5 pb-5">
                    <Link
                        href={href}
                        aria-disabled={!staysWritten}
                        tabIndex={staysWritten ? undefined : -1}
                        className="block rounded-full px-5 py-3 text-center text-sm font-semibold text-white transition-[filter,opacity] duration-200 hover:brightness-110"
                        style={{
                            background: BRAND.gradient,
                            boxShadow: BRAND.gradientShadow,
                            opacity: staysWritten ? 1 : 0.35,
                            pointerEvents: staysWritten ? undefined : 'none',
                        }}
                    >
                        Search this trip
                    </Link>
                </div>

                <TicketStub note={pass.touched ? 'Edited by you' : 'Scroll to build your trip'} />
            </div>
        </aside>
    );
}
