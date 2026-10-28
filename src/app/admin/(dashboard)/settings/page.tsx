'use client';

import { useEffect, useState } from 'react';
import { Save, CheckCircle2, AlertCircle, Settings2, Globe } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface AppSettings {
    portal_name?:           string;
    admin_email?:           string;
    platform_description?:  string;
    public_registration?:   boolean;
    default_currency?:      string;
    timezone?:              string;
    cache_duration?:        number;
    /** Hotel search and booking off sale. Flights are a different supplier and unaffected. */
    stays_maintenance?:     boolean | string;
    /** Last verdict from the supplier canary in `/cron/supplier-health`. */
    stays_health_status?:     string;
    stays_health_detail?:     string;
    stays_health_checked_at?: string;
    [key: string]:          unknown;
}

const TABS = [
    { id: 'general',       icon: Settings2, label: 'General' },
    { id: 'localization',  icon: Globe,     label: 'Localization' },
] as const;

type TabId = typeof TABS[number]['id'];

const TIMEZONES = [
    'Asia/Manila', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
    'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
];

const CURRENCIES = ['USD', 'PHP', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY', 'HKD'];

export default function AdminSettingsPage() {
    const [_settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null);

    // Form state
    const [portalName, setPortalName]         = useState('');
    const [adminEmail, setAdminEmail]         = useState('');
    const [description, setDescription]       = useState('');
    const [publicReg, setPublicReg]           = useState(true);
    const [currency, setCurrency]             = useState('USD');
    const [timezone, setTimezone]             = useState('Asia/Manila');
    const [cacheDuration, setCacheDuration]   = useState(60);
    const [staysMaintenance, setStaysMaintenance] = useState(false);
    const [health, setHealth] = useState<{ status?: string; detail?: string | null; checkedAt?: string | null }>({});
    const [checkingHealth, setCheckingHealth] = useState(false);

    /**
     * Run the supplier canary now.
     *
     * It writes its own verdict and may flip the switch above, so the toggle is re-read from
     * the response rather than left showing a value the probe has already changed.
     */
    async function runHealthCheck() {
        setCheckingHealth(true);
        setToast(null);
        try {
            const r = await http.get<{ status: string; detail: string; checkedAt?: string; maintenance?: boolean }>(
                '/admin/supplier-health',
            );
            setHealth({ status: r.status, detail: r.detail, checkedAt: r.checkedAt ?? new Date().toISOString() });
            if (typeof r.maintenance === 'boolean') setStaysMaintenance(r.maintenance);
            setToast({ ok: r.status === 'healthy', msg: `Supplier ${r.status} — ${r.detail}` });
        } catch (err: unknown) {
            setToast({ ok: false, msg: err instanceof Error ? err.message : 'Health check failed.' });
        } finally {
            setCheckingHealth(false);
            setTimeout(() => setToast(null), 6000);
        }
    }

    useEffect(() => {
        http.get<AppSettings>('/admin/settings')
            .then(s => {
                setSettings(s);
                setPortalName(s.portal_name ?? '');
                setAdminEmail(s.admin_email ?? '');
                setDescription(s.platform_description ?? '');
                setPublicReg(s.public_registration ?? true);
                setCurrency(s.default_currency ?? 'USD');
                setTimezone(s.timezone ?? 'Asia/Manila');
                setCacheDuration(s.cache_duration ?? 60);
                setStaysMaintenance(s.stays_maintenance === true || s.stays_maintenance === 'true');
                setHealth({
                    status:    s.stays_health_status as string | undefined,
                    detail:    s.stays_health_detail as string | undefined,
                    checkedAt: s.stays_health_checked_at as string | undefined,
                });
            })
            .catch(err => setError(err instanceof Error ? err.message : 'Failed to load settings.'))
            .finally(() => setLoading(false));
    }, []);

    async function handleSave() {
        setSaving(true);
        setToast(null);
        try {
            await http.put('/admin/settings', {
                portal_name:            portalName,
                admin_email:            adminEmail,
                platform_description:   description,
                public_registration:    publicReg,
                stays_maintenance:      staysMaintenance,
                default_currency:       currency,
                timezone,
                cache_duration:         cacheDuration,
            });
            setToast({ ok: true, msg: 'Settings saved.' });
        } catch (err: unknown) {
            setToast({ ok: false, msg: err instanceof Error ? err.message : 'Save failed.' });
        } finally {
            setSaving(false);
            setTimeout(() => setToast(null), 4000);
        }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-64" />
                <div className="mt-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Settings</h1>
                <p className="text-sm text-slate-500 mt-0.5">Platform configuration</p>
            </div>

            {error && <div className="p-4 text-sm text-rose-500 bg-rose-50 border border-rose-200 rounded-xl">{error}</div>}

            {toast && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border ${toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="space-y-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                            }`}
                        >
                            <tab.icon size={16} />
                            <span className="text-sm font-bold">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                        {activeTab === 'general' && (
                            <>
                                <h2 className="text-sm font-bold text-slate-900">General Configuration</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label="Portal Name"
                                        value={portalName}
                                        onChange={e => setPortalName(e.target.value)}
                                        placeholder="CheapestGo Admin"
                                    />
                                    <Input
                                        label="Admin Email"
                                        type="email"
                                        value={adminEmail}
                                        onChange={e => setAdminEmail(e.target.value)}
                                        placeholder="admin@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 block mb-1.5">Platform Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full rounded-xl border border-slate-200 bg-white text-sm px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all"
                                        placeholder="Flight and hotel booking platform…"
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Public Registration</p>
                                        <p className="text-xs text-slate-500">Allow new users to sign up</p>
                                    </div>
                                    <button
                                        onClick={() => setPublicReg(v => !v)}
                                        className={`w-12 h-6 rounded-full relative transition-colors ${publicReg ? 'bg-blue-600' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${publicReg ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                {/* Supplier health — the canary search, not the gateway ping.
                                    `/admin/tgx-health` answers "is TravelgateX reachable", which
                                    stayed green throughout the 2026-10-26 outage. This answers
                                    "did a city that is never empty return rooms". */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900">
                                                Hotel Supplier Health
                                                <span className={`ml-2 align-middle text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                    health.status === 'healthy' ? 'bg-emerald-100 text-emerald-700'
                                                    : health.status === 'down'  ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-slate-200 text-slate-600'
                                                }`}>
                                                    {health.status ?? 'never checked'}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 break-words">
                                                {health.detail || 'Searches a city that is never empty; switches maintenance on by itself'}
                                            </p>
                                            {health.checkedAt && (
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Last checked {new Date(health.checkedAt).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={runHealthCheck}
                                            disabled={checkingHealth}
                                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            {checkingHealth ? 'Checking…' : 'Check now'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Stays Maintenance Mode</p>
                                        <p className="text-xs text-slate-500">Hotel search and booking off — flights unaffected</p>
                                    </div>
                                    <button
                                        onClick={() => setStaysMaintenance(v => !v)}
                                        className={`w-12 h-6 rounded-full relative transition-colors ${staysMaintenance ? 'bg-amber-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${staysMaintenance ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>
                                {staysMaintenance && (
                                    <p className="text-xs font-semibold text-amber-700 -mt-1">
                                        Visitors see a notice instead of hotel results, and no search reaches the supplier.
                                        Remember to save — this toggle is part of the form.
                                    </p>
                                )}
                            </>
                        )}

                        {activeTab === 'localization' && (
                            <>
                                <h2 className="text-sm font-bold text-slate-900">Localization</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 block mb-1.5">Default Currency</label>
                                        <select
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        >
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 block mb-1.5">Timezone</label>
                                        <select
                                            value={timezone}
                                            onChange={e => setTimezone(e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        >
                                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="max-w-xs">
                                    <Input
                                        label="API Cache Duration (minutes)"
                                        type="number"
                                        value={String(cacheDuration)}
                                        onChange={e => setCacheDuration(Number(e.target.value))}
                                    />
                                </div>
                            </>
                        )}

                        <div className="pt-4 border-t border-slate-100">
                            <Button onClick={handleSave} isLoading={saving} size="sm">
                                <Save size={14} />
                                {saving ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
