// src/features/golf-api-demo/components/golf-api-demo-view.tsx
'use client';

import { useEffect, useState } from 'react';
import {
    Flag, RefreshCw, Clock, AlertTriangle, CheckCircle2, XCircle,
    ExternalLink, ChevronDown, ChevronRight, FlaskConical, Users, Search, PackagePlus,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { env } from '@/shared/lib/env';
import { golfMockApi } from '@/features/golf-api-demo/api/golfMockApi.client';
import { GOLF_SERVICE_CATEGORIES, MOCK_SCENARIOS, SERVICE_CATEGORY_LABEL } from '@/features/golf-api-demo/types';
import type {
    MockAvailability, MockBooking, MockCallLogEntry, MockCancelResult,
    MockCourse, MockHold, MockScenario, MockService, MockServiceBooking, MockTeeTime,
} from '@/features/golf-api-demo/types';

const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);

const SCENARIO_LABEL: Record<MockScenario, string> = {
    ok: 'Normal', price_up: 'Price moved up', price_down: 'Price moved down', sold_out: 'Sold out',
    hold_timeout: 'Hold: no answer', book_rejected: 'Booking rejected', book_timeout: 'Booking: no answer',
    cancel_rejected: 'Cancellation refused', cancel_timeout: 'Cancellation: no answer',
};

type Step = 'courses' | 'tee-times' | 'held' | 'confirmed' | 'cancelled';

const SERVICE_ACTION_LABEL: Record<MockService['bookingMode'], string> = {
    product: 'Buy', appointment: 'Book', inquiry: 'Request',
};

function errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Something went wrong.';
}

function HoldCountdown({ expiresAt }: { expiresAt: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
    const secondsLeft = Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000));
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return (
        <span className={secondsLeft === 0 ? 'text-rose-600 font-bold' : 'font-bold text-amber-600'}>
            {secondsLeft === 0 ? 'expired' : `${m}:${String(s).padStart(2, '0')}`}
        </span>
    );
}

export function GolfApiDemoView() {
    const [step, setStep] = useState<Step>('courses');
    const [courses, setCourses] = useState<MockCourse[] | null>(null);
    const [countries, setCountries] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [course, setCourse] = useState<MockCourse | null>(null);
    const [players, setPlayers] = useState(2);
    const [availability, setAvailability] = useState<MockAvailability | null>(null);
    const [hold, setHold] = useState<MockHold | null>(null);
    const [heldTeeTime, setHeldTeeTime] = useState<MockTeeTime | null>(null);
    const [booking, setBooking] = useState<MockBooking | null>(null);
    const [cancelResult, setCancelResult] = useState<MockCancelResult | null>(null);
    const [scenario, setScenario] = useState<MockScenario | null>(null);
    const [leadName, setLeadName] = useState('J. Rivera');
    const [contactEmail, setContactEmail] = useState('demo@cheapestgo.com');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [log, setLog] = useState<MockCallLogEntry[]>([]);
    const [logOpen, setLogOpen] = useState(false);

    // Golf Services: the same catalog on every course (see golfMockApi docs) — loaded once.
    const [services, setServices] = useState<MockService[] | null>(null);
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
    const [serviceForm, setServiceForm] = useState({ quantity: '1', preferredDate: '', partySize: '', notes: '' });
    const [serviceBookings, setServiceBookings] = useState<Record<string, MockServiceBooking>>({});
    const [serviceBusyId, setServiceBusyId] = useState<string | null>(null);
    const [serviceError, setServiceError] = useState<string | null>(null);

    const mockApiBase = env.NEXT_PUBLIC_API_URL.replace(/\/api\/v2\/?$/, '') + '/api/v1/golf';

    async function call<T>(method: string, path: string, fn: () => Promise<{ data: T; status: number }>, request?: unknown): Promise<T> {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        try {
            const { data, status } = await fn();
            const entry: MockCallLogEntry = { id, method, path, status, request, response: data, at: new Date().toISOString() };
            setLog((l) => [entry, ...l].slice(0, 12));
            return data;
        } catch (err) {
            const body = (err as { body?: unknown })?.body;
            const entry: MockCallLogEntry = { id, method, path, status: 'error', request, response: body ?? errMessage(err), at: new Date().toISOString() };
            setLog((l) => [entry, ...l].slice(0, 12));
            throw err;
        }
    }

    async function loadCourses(opts: { query?: string; country?: string } = {}) {
        setBusy(true); setError(null);
        try {
            const path = `/courses${opts.query || opts.country ? `?${new URLSearchParams(opts as Record<string, string>).toString()}` : ''}`;
            const res = await call('GET', path, () => golfMockApi.listCourses(opts));
            setCourses(res.courses);
            setCountries(res.countries ?? []);
        } catch (err) { setError(errMessage(err)); } finally { setBusy(false); }
    }

    // Initial load, and once-off scenario fetch — not debounced, since nothing has been typed yet.
    useEffect(() => {
        loadCourses();
        golfMockApi.getScenario().then((r) => setScenario(r.data.scenario)).catch(() => {});
        golfMockApi.listServices().then((r) => setServices(r.data.services)).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-query as the search box or country filter change, debounced so typing doesn't fire a
    // request per keystroke. Skipped on the very first render — the effect above already loaded.
    const [filtersTouched, setFiltersTouched] = useState(false);
    useEffect(() => {
        if (!filtersTouched) return;
        const timer = window.setTimeout(() => {
            loadCourses({ query: searchQuery || undefined, country: countryFilter || undefined });
        }, 300);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, countryFilter, filtersTouched]);

    async function pickCourse(c: MockCourse) {
        setCourse(c); setStep('tee-times'); setError(null); setAvailability(null);
        await loadTeeTimes(c, players);
    }

    async function loadTeeTimes(c: MockCourse, forPlayers: number) {
        setBusy(true); setError(null);
        try {
            const data = await call('GET', `/courses/${c.slug}/tee-times?players=${forPlayers}`, () => golfMockApi.getTeeTimes(c.slug, { players: forPlayers }));
            setAvailability(data);
        } catch (err) { setError(errMessage(err)); } finally { setBusy(false); }
    }

    async function changePlayers(n: number) {
        setPlayers(n);
        if (course) await loadTeeTimes(course, n);
    }

    async function pickTeeTime(t: MockTeeTime) {
        if (!course) return;
        setBusy(true); setError(null);
        try {
            const body = { courseId: course.id, teeTimeId: t.id, players, leadName, contactEmail };
            const h = await call('POST', '/holds', () => golfMockApi.hold(body), body);
            setHold(h); setHeldTeeTime(t); setStep('held');
        } catch (err) { setError(errMessage(err)); } finally { setBusy(false); }
    }

    async function confirmBooking() {
        if (!hold || !heldTeeTime || !course) return;
        setBusy(true); setError(null);
        try {
            const body = {
                holdId: hold.holdId, courseId: course.id, teeTimeId: heldTeeTime.id, players,
                leadName, contactEmail, currency: hold.currency, total: hold.total,
            };
            const b = await call('POST', '/bookings', () => golfMockApi.book(body), body);
            setBooking(b); setStep('confirmed');
        } catch (err) { setError(errMessage(err)); } finally { setBusy(false); }
    }

    async function cancelBooking() {
        if (!booking) return;
        setBusy(true); setError(null);
        try {
            const r = await call('POST', `/bookings/${booking.reference}/cancel`, () => golfMockApi.cancelBooking(booking.reference));
            setCancelResult(r); setStep('cancelled');
        } catch (err) { setError(errMessage(err)); } finally { setBusy(false); }
    }

    async function changeScenario(next: MockScenario | 'ok') {
        const value = next === 'ok' ? null : next;
        setBusy(true);
        try {
            const r = await call('PUT', '/scenario', () => golfMockApi.setScenario(value), { scenario: value });
            setScenario(r.scenario);
            if (course) await loadTeeTimes(course, players); // the catalogue may look different now
        } catch (err) { setError(errMessage(err)); } finally { setBusy(false); }
    }

    function startOver() {
        setStep('courses'); setCourse(null); setAvailability(null); setHold(null);
        setHeldTeeTime(null); setBooking(null); setCancelResult(null); setError(null);
    }

    function toggleService(id: string) {
        setServiceError(null);
        setExpandedServiceId((cur) => (cur === id ? null : id));
        setServiceForm({ quantity: '1', preferredDate: '', partySize: '', notes: '' });
    }

    async function submitService(service: MockService) {
        setServiceBusyId(service.id); setServiceError(null);
        try {
            const body = {
                leadName, contactEmail, courseId: course?.id,
                ...(service.bookingMode === 'product' ? { quantity: Number(serviceForm.quantity) || 1 } : {}),
                ...(service.bookingMode === 'appointment'
                    ? { preferredDate: serviceForm.preferredDate, quantity: Number(serviceForm.quantity) || 1 } : {}),
                ...(service.bookingMode === 'inquiry' ? {
                    preferredDate: serviceForm.preferredDate || undefined,
                    partySize: serviceForm.partySize ? Number(serviceForm.partySize) : undefined,
                    notes: serviceForm.notes || undefined,
                } : {}),
            };
            const result = await call('POST', `/services/${service.id}/book`, () => golfMockApi.bookService(service.id, body), body);
            setServiceBookings((b) => ({ ...b, [service.id]: result }));
            setExpandedServiceId(null);
        } catch (err) { setServiceError(errMessage(err)); } finally { setServiceBusyId(null); }
    }

    async function cancelServiceBooking(service: MockService) {
        const existing = serviceBookings[service.id];
        if (!existing) return;
        setServiceBusyId(service.id); setServiceError(null);
        try {
            const result = await call('POST', `/services/bookings/${existing.reference}/cancel`, () => golfMockApi.cancelServiceBooking(existing.reference));
            setServiceBookings((b) => ({ ...b, [service.id]: result }));
        } catch (err) { setServiceError(errMessage(err)); } finally { setServiceBusyId(null); }
    }

    return (
        <div className="px-5 py-4 space-y-4 max-w-5xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Flag size={16} className="text-emerald-600" /></div>
                    <div>
                        <h1 className="text-base font-semibold text-slate-900">Golf API <span className="text-slate-400 font-normal">— Mock</span></h1>
                        <p className="text-xs text-slate-500 mt-0.5">A fully simulated golf booking API — demoable, nothing real moves.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <a href={`${mockApiBase}/docs`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                        Swagger UI <ExternalLink size={11} />
                    </a>
                    <Button variant="outline" size="sm"
                        onClick={() => loadCourses({ query: searchQuery || undefined, country: countryFilter || undefined })}
                        isLoading={busy && step === 'courses'}><RefreshCw size={13} /></Button>
                </div>
            </div>

            {/* Scenario control */}
            <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex items-center gap-3 flex-wrap">
                <FlaskConical size={15} className="text-purple-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700">Simulate:</span>
                <select
                    className="text-xs font-bold border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50 text-slate-700"
                    value={scenario ?? 'ok'}
                    onChange={(e) => changeScenario(e.target.value as MockScenario)}
                >
                    {MOCK_SCENARIOS.map((s) => <option key={s} value={s}>{SCENARIO_LABEL[s]}</option>)}
                </select>
                {scenario && scenario !== 'ok' && (
                    <Badge variant="warning">forcing every course: {SCENARIO_LABEL[scenario]}</Badge>
                )}
                <span className="text-[11px] text-slate-400">Not part of a real supplier&rsquo;s contract — demo-only.</span>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    <AlertTriangle size={15} className="shrink-0" /> {error}
                </div>
            )}

            {/* Step: courses */}
            {step === 'courses' && (
                <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setFiltersTouched(true); }}
                                placeholder="Search courses by name or city"
                                className="w-full text-xs border border-slate-200 rounded-md pl-7 pr-2.5 py-1.5"
                            />
                        </div>
                        <select
                            aria-label="Country"
                            value={countryFilter}
                            onChange={(e) => { setCountryFilter(e.target.value); setFiltersTouched(true); }}
                            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700"
                        >
                            <option value="">All countries</option>
                            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    {courses === null ? (
                        <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : courses.length === 0 ? (
                        <div className="p-10 text-center text-sm text-slate-400">
                            {searchQuery || countryFilter ? 'No courses match your search.' : 'No courses in the catalogue.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {courses.map((c) => (
                                <button key={c.id} onClick={() => pickCourse(c)}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{c.name}</p>
                                        <p className="text-xs text-slate-500">{c.city}, {c.country} · {c.holes} holes</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-sm font-bold text-slate-900">{c.greenFeeFrom != null ? fmt(c.greenFeeFrom, c.currency) : '—'}</span>
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            )}

            {/* Step: tee times */}
            {step === 'tee-times' && course && (
                <div className="space-y-3">
                    <button onClick={startOver} className="text-xs font-bold text-slate-500 hover:text-slate-900">&larr; All courses</button>
                    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <p className="text-sm font-bold text-slate-900">{course.name}</p>
                                <p className="text-xs text-slate-500">{availability ? `${availability.date} · ${availability.timezone}` : '…'}</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <Users size={13} /> Players
                                <select className="border border-slate-200 rounded-md px-1.5 py-1 bg-slate-50"
                                    value={players} onChange={(e) => changePlayers(Number(e.target.value))}>
                                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Lead golfer's name"
                                className="flex-1 min-w-[160px] text-xs border border-slate-200 rounded-md px-2.5 py-1.5" />
                            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" type="email"
                                className="flex-1 min-w-[160px] text-xs border border-slate-200 rounded-md px-2.5 py-1.5" />
                        </div>

                        {busy && !availability && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
                        {availability && availability.teeTimes.length === 0 && (
                            <div className="p-6 text-center text-sm text-slate-400 bg-slate-50 rounded-md">
                                No open tee times — try a different scenario or player count.
                            </div>
                        )}
                        {availability && availability.teeTimes.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {availability.teeTimes.map((t) => (
                                    <button key={t.id} onClick={() => pickTeeTime(t)} disabled={busy}
                                        className="flex flex-col items-start gap-0.5 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-emerald-400 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                                        <span className="text-sm font-bold text-slate-900">{t.localTime}</span>
                                        <span className="text-xs text-slate-500">{fmt(t.pricePerPlayer, t.currency)}/player</span>
                                        <span className="text-[11px] text-slate-400">{t.spotsLeft} spots left</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step: held */}
            {step === 'held' && hold && heldTeeTime && course && (
                <div className="bg-white rounded-lg border border-amber-200 p-4 space-y-3">
                    <div className="flex items-center gap-2"><Clock size={16} className="text-amber-500" /><p className="text-sm font-bold text-slate-900">Tee time held</p></div>
                    <p className="text-xs text-slate-500">{course.name} · {heldTeeTime.localTime} · {players} player{players > 1 ? 's' : ''}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><p className="text-slate-400">Reference</p><p className="font-mono font-bold text-slate-900">{hold.reference}</p></div>
                        <div><p className="text-slate-400">Expires in</p><HoldCountdown expiresAt={hold.expiresAt} /></div>
                        <div><p className="text-slate-400">Green fee</p><p className="font-bold text-slate-900">{fmt(hold.greenFeeTotal, hold.currency)}</p></div>
                        <div><p className="text-slate-400">Total</p><p className="font-bold text-slate-900">{fmt(hold.total, hold.currency)}</p></div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={confirmBooking} isLoading={busy}>Confirm booking</Button>
                        <Button size="sm" variant="outline" onClick={startOver}>Let it expire</Button>
                    </div>
                </div>
            )}

            {/* Step: confirmed */}
            {step === 'confirmed' && booking && (
                <div className="bg-white rounded-lg border border-emerald-200 p-4 space-y-3">
                    <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /><p className="text-sm font-bold text-slate-900">Booking confirmed</p></div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><p className="text-slate-400">Reference</p><p className="font-mono font-bold text-slate-900">{booking.reference}</p></div>
                        <div><p className="text-slate-400">Status</p><Badge variant="success">{booking.status}</Badge></div>
                        {booking.greenFeeTotal != null && (
                            <div><p className="text-slate-400">Green fee</p><p className="font-bold text-slate-900">{fmt(booking.greenFeeTotal, booking.currency)}</p></div>
                        )}
                        {booking.extrasTotal != null && booking.extrasTotal > 0 && (
                            <div><p className="text-slate-400">Extras</p><p className="font-bold text-slate-900">{fmt(booking.extrasTotal, booking.currency)}</p></div>
                        )}
                        {booking.serviceFee != null && (
                            <div><p className="text-slate-400">Service fee</p><p className="font-bold text-slate-900">{fmt(booking.serviceFee, booking.currency)}</p></div>
                        )}
                        <div><p className="text-slate-400">Total</p><p className="font-bold text-slate-900">{fmt(booking.total, booking.currency)}</p></div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        {booking.cancellable !== false ? (
                            <Button size="sm" variant="destructive" onClick={cancelBooking} isLoading={busy}>Cancel booking</Button>
                        ) : (
                            <span className="text-xs text-slate-400 italic self-center">This booking can no longer be cancelled.</span>
                        )}
                        <Button size="sm" variant="outline" onClick={startOver}>Start over</Button>
                    </div>
                </div>
            )}

            {/* Step: cancelled */}
            {step === 'cancelled' && cancelResult && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center gap-2"><XCircle size={16} className="text-slate-400" /><p className="text-sm font-bold text-slate-900">Booking cancelled</p></div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><p className="text-slate-400">Refund eligible</p><p className="font-bold text-slate-900">{cancelResult.refundEligible ? 'Yes' : 'No'}</p></div>
                        {cancelResult.refundEligible && (
                            <div><p className="text-slate-400">Refund</p><p className="font-bold text-slate-900">{fmt(cancelResult.refundAmount ?? 0, cancelResult.currency ?? 'USD')}</p></div>
                        )}
                    </div>
                    <Button size="sm" variant="outline" onClick={startOver}>Start over</Button>
                </div>
            )}

            {/* Golf Services — the same catalog on every course, shown once one is selected */}
            {course && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <PackagePlus size={16} className="text-indigo-500" />
                        <p className="text-sm font-bold text-slate-900">Golf Services</p>
                        <span className="text-[11px] text-slate-400">Same catalog on every course &mdash; lessons, fitting, equipment, tournaments, memberships, simulation, events.</span>
                    </div>

                    {serviceError && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                            <AlertTriangle size={14} className="shrink-0" /> {serviceError}
                        </div>
                    )}

                    {services === null ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    ) : (
                        <div className="space-y-4">
                            {GOLF_SERVICE_CATEGORIES.map((category) => {
                                const items = services.filter((s) => s.category === category);
                                if (items.length === 0) return null;
                                return (
                                    <div key={category}>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{SERVICE_CATEGORY_LABEL[category]}</p>
                                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-md">
                                            {items.map((service) => {
                                                const existing = serviceBookings[service.id];
                                                const isOpen = expandedServiceId === service.id;
                                                const isBusy = serviceBusyId === service.id;
                                                return (
                                                    <div key={service.id} className="p-2.5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-900">{service.name}</p>
                                                                <p className="text-[11px] text-slate-500">{service.description}</p>
                                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                                    {service.price != null ? `${fmt(service.price, service.currency)} ${service.unit}` : 'Contact for a quote'}
                                                                </p>
                                                            </div>
                                                            {!existing && (
                                                                <Button size="sm" variant="outline" onClick={() => toggleService(service.id)} disabled={isBusy}>
                                                                    {SERVICE_ACTION_LABEL[service.bookingMode]}
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {isOpen && !existing && (
                                                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
                                                                {(service.bookingMode === 'product' || service.bookingMode === 'appointment') && (
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-[11px] font-bold text-slate-500 w-24">
                                                                            {service.bookingMode === 'product' ? 'Quantity' : service.unit === 'per hour' ? 'Hours' : 'Sessions'}
                                                                        </label>
                                                                        <input type="number" min={1} max={20} value={serviceForm.quantity}
                                                                            onChange={(e) => setServiceForm((f) => ({ ...f, quantity: e.target.value }))}
                                                                            className="w-20 text-xs border border-slate-200 rounded-md px-2 py-1" />
                                                                    </div>
                                                                )}
                                                                {service.bookingMode === 'appointment' && (
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-[11px] font-bold text-slate-500 w-24">Preferred date</label>
                                                                        <input type="date" value={serviceForm.preferredDate}
                                                                            onChange={(e) => setServiceForm((f) => ({ ...f, preferredDate: e.target.value }))}
                                                                            className="text-xs border border-slate-200 rounded-md px-2 py-1" />
                                                                    </div>
                                                                )}
                                                                {service.bookingMode === 'inquiry' && (
                                                                    <>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[11px] font-bold text-slate-500 w-24">Preferred date</label>
                                                                            <input type="date" value={serviceForm.preferredDate}
                                                                                onChange={(e) => setServiceForm((f) => ({ ...f, preferredDate: e.target.value }))}
                                                                                className="text-xs border border-slate-200 rounded-md px-2 py-1" />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[11px] font-bold text-slate-500 w-24">Party size</label>
                                                                            <input type="number" min={1} max={500} value={serviceForm.partySize}
                                                                                onChange={(e) => setServiceForm((f) => ({ ...f, partySize: e.target.value }))}
                                                                                className="w-20 text-xs border border-slate-200 rounded-md px-2 py-1" />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[11px] font-bold text-slate-500 w-24">Notes</label>
                                                                            <input type="text" value={serviceForm.notes}
                                                                                onChange={(e) => setServiceForm((f) => ({ ...f, notes: e.target.value }))}
                                                                                placeholder="Optional"
                                                                                className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1" />
                                                                        </div>
                                                                    </>
                                                                )}
                                                                <div className="flex gap-2 pt-1">
                                                                    <Button size="sm" onClick={() => submitService(service)} isLoading={isBusy}>
                                                                        {SERVICE_ACTION_LABEL[service.bookingMode]} now
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" onClick={() => toggleService(service.id)}>Cancel</Button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {existing && (
                                                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] bg-slate-50 rounded-md px-2.5 py-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant={existing.status === 'confirmed' ? 'success' : 'default'} size="sm">{existing.status}</Badge>
                                                                    <span className="font-mono text-slate-500">{existing.reference}</span>
                                                                    <span className="font-bold text-slate-700">{existing.total != null ? fmt(existing.total, existing.currency) : 'Quote pending'}</span>
                                                                </div>
                                                                {existing.status === 'confirmed' && (
                                                                    <Button size="sm" variant="destructive" onClick={() => cancelServiceBooking(service)} isLoading={isBusy}>Cancel</Button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Call log */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setLogOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                    <span>Request log ({log.length})</span>
                    <ChevronDown size={14} className={logOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {logOpen && (
                    <div className="border-t border-slate-100 max-h-80 overflow-auto divide-y divide-slate-100">
                        {log.length === 0 && <p className="p-4 text-xs text-slate-400">Nothing called yet.</p>}
                        {log.map((entry) => (
                            <div key={entry.id} className="p-3 text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={entry.status === 'error' || (typeof entry.status === 'number' && entry.status >= 400) ? 'destructive' : 'success'} size="sm">
                                        {typeof entry.status === 'number' ? entry.status : 'ERR'}
                                    </Badge>
                                    <span className="font-mono font-bold text-slate-700">{entry.method} {entry.path}</span>
                                </div>
                                <pre className="bg-slate-900 text-slate-100 rounded-md p-2 overflow-x-auto text-[11px]">{JSON.stringify(entry.response, null, 2)}</pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
