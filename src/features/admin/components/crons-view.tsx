'use client';

/**
 * Run a scheduled job by hand, and see what it said.
 *
 * v2 has had every one of these endpoints since C6 — twenty-one of them, two more than
 * v1 — but no screen, so the only way to trigger one was curl with an admin session.
 * This is that screen.
 *
 * The list is written out rather than fetched: a cron's schedule and its warnings live
 * in the deployment's configuration, not in the API, and an endpoint that enumerated
 * itself would still not know when the scheduler actually calls it.
 */
import { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { Button } from '@/shared/components/ui/button';

interface CronDef {
    id: string;
    label: string;
    description: string;
    schedule: string;
    /** Shown before it is run, not after. A ten-minute job is worth warning about. */
    warning?: string;
}

const CRONS: CronDef[] = [
    { id: 'poll-pending-tickets',           label: 'Poll Pending Tickets',           description: 'Polls Duffel and Mystifly for pending flight ticket status updates.', schedule: 'Every 5 min' },
    { id: 'check-price-alerts',             label: 'Price Alerts',                   description: 'Emails travellers whose saved routes have dropped in price.',         schedule: 'Hourly' },
    { id: 'refresh-popular-flights',        label: 'Refresh Popular Flights',        description: 'Pre-fetches and caches the most-searched flight routes.',             schedule: 'Hourly' },
    { id: 'sync-flight-deals',              label: 'Sync Flight Deals',              description: 'Syncs curated flight deals from providers into the deals table.',     schedule: 'Hourly' },
    { id: 'sync-hotel-deals',               label: 'Sync Hotel Deals',               description: 'Syncs curated hotel deals into the deals table.',                     schedule: 'Hourly' },
    { id: 'duffel-balance-check',           label: 'Duffel Balance Check',           description: 'Watches the Duffel account balance and alerts when it runs low.',     schedule: 'Daily' },
    { id: 'cache-cleanup',                  label: 'Cache Cleanup',                  description: 'Purges expired search cache rows and stale hotel review items.',      schedule: 'Daily' },
    { id: 'cleanup-sessions',               label: 'Session Cleanup',                description: 'Deletes expired auth sessions and password reset tokens.',            schedule: 'Daily 4am' },
    { id: 'otv-credit-check',               label: 'OTV Credit Check',               description: 'Monitors TravelgateX OTV credit balance and alerts when low.',        schedule: 'Daily' },
    { id: 'fill-dest-cache',                label: 'Fill Destination Cache',         description: 'Pre-populates the TGX destination code cache for fast lookups.',      schedule: 'Daily' },
    { id: 'sync-dest-cache',                label: 'Sync Destination Cache',         description: 'Syncs the destination cache with the latest TravelgateX city data.',  schedule: 'Daily' },
    { id: 'cleanup-orphaned-duffel-orders', label: 'Cleanup Orphaned Duffel Orders', description: 'Cancels Duffel orders with no matching booking row.',                 schedule: 'Daily' },
    { id: 'hotel-reconciliation',           label: 'Hotel Reconciliation',           description: 'Reconciles hotel bookings against the supplier’s own record.',        schedule: 'Daily' },
    { id: 'platform-cost-reconciliation',   label: 'Platform Cost Reconciliation',   description: 'Reconciles supplier cost against what was charged.',                  schedule: 'Daily' },
    { id: 'purge-support-attachments',      label: 'Purge Support Attachments',      description: 'Deletes support chat attachments past their retention window.',       schedule: 'Daily' },
    { id: 'resume-support-translations',    label: 'Resume Support Translations',    description: 'Picks up message translations that were left pending.',               schedule: 'Every 15 min' },
    { id: 'etg-reviews-sync',               label: 'ETG Reviews Sync',               description: 'Syncs hotel review scores and content from the ETG reviews API.',     schedule: 'Nightly' },
    { id: 'etg-dump-sync',                  label: 'ETG Dump Sync',                  description: 'Ingests the ETG hotel dump.',                                         schedule: 'Nightly', warning: 'Long-running and bandwidth-heavy.' },
    { id: 'geocode-hotels',                 label: 'Geocode Hotels',                 description: 'Adds coordinates to hotels missing location data.',                   schedule: 'Nightly' },
    { id: 'seed-room-groups',               label: 'Seed Room Groups',               description: 'Rebuilds the room-name grouping used to dedupe offers.',              schedule: 'Weekly' },
    { id: 'refresh-hotel-content',          label: 'Refresh Hotel Content',          description: 'Refreshes hotel metadata from TravelgateX.',                          schedule: 'Weekly', warning: 'Long-running — may take up to 10 minutes.' },
];

interface RunResult {
    success: boolean;
    durationMs?: number;
    result?: unknown;
    error?: string;
}

export function CronsView() {
    const [running, setRunning] = useState<Record<string, boolean>>({});
    const [results, setResults] = useState<Record<string, RunResult>>({});

    async function run(id: string) {
        setRunning((r) => ({ ...r, [id]: true }));
        setResults((r) => { const next = { ...r }; delete next[id]; return next; });
        const started = Date.now();
        try {
            const res = await http.post<Record<string, unknown>>('/admin/run-cron', { cron: id });
            setResults((r) => ({ ...r, [id]: { success: true, durationMs: Date.now() - started, result: res } }));
        } catch (err) {
            setResults((r) => ({
                ...r,
                [id]: { success: false, durationMs: Date.now() - started, error: err instanceof Error ? err.message : 'Failed' },
            }));
        } finally {
            setRunning((r) => ({ ...r, [id]: false }));
        }
    }

    return (
        <div className="space-y-4 p-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scheduled jobs</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Runs the job now, as the scheduler would. The response is shown as the job returned it.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {CRONS.map((cron) => {
                    const busy = running[cron.id];
                    const result = results[cron.id];
                    return (
                        <div key={cron.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{cron.label}</p>
                                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                        <Clock size={11} />{cron.schedule}
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(cron.id)}>
                                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                                </Button>
                            </div>

                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{cron.description}</p>

                            {cron.warning && (
                                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />{cron.warning}
                                </p>
                            )}

                            {result && (
                                <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
                                    <p className={`flex items-center gap-1.5 text-xs font-medium ${result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {result.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                        {result.success ? 'Ran' : 'Failed'}
                                        {result.durationMs != null && <span className="font-normal text-slate-400">· {(result.durationMs / 1000).toFixed(1)}s</span>}
                                    </p>
                                    {/* Whatever the job said, verbatim. A summarised result is a result
                                        nobody can debug from. */}
                                    <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                                        {result.error ?? JSON.stringify(result.result, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
