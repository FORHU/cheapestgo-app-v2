'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, Shield, UserCheck, Clock, Search, X } from 'lucide-react';
import { http } from '@/shared/lib/http';
import { StatsCard } from '@/features/admin/components/stats-card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface AdminUser {
    id:        string;
    fullName:  string;
    email:     string;
    role:      'user' | 'admin';
    isBanned:  boolean;
    createdAt: string;
}

interface UsersResponse {
    users: AdminUser[];
    total: number;
}

function SkeletonRows() {
    return (
        <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers]           = useState<AdminUser[]>([]);
    const [total, setTotal]           = useState(0);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState<string | null>(null);
    const [search, setSearch]         = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
    const [actionId, setActionId]     = useState<string | null>(null);
    const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null);

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await http.get<UsersResponse>('/admin/users');
            setUsers(res.users ?? []);
            setTotal(res.total ?? 0);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load users.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        return users.filter(u => {
            const matchSearch = !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
            const matchRole = roleFilter === 'all' || u.role === roleFilter;
            return matchSearch && matchRole;
        });
    }, [users, search, roleFilter]);

    const totalAdmins  = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
    const recentSignups = useMemo(() => {
        const ago = new Date(); ago.setDate(ago.getDate() - 30);
        return users.filter(u => new Date(u.createdAt) >= ago).length;
    }, [users]);

    async function handleBan(user: AdminUser) {
        const action = user.isBanned ? 'unban' : 'ban';
        if (!confirm(`${action === 'ban' ? 'Ban' : 'Unban'} ${user.fullName}?`)) return;
        setActionId(user.id);
        try {
            await http.post(`/admin/users/${user.id}/${action}`);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: !u.isBanned } : u));
            showToast(true, `User ${action === 'ban' ? 'banned' : 'unbanned'} successfully.`);
        } catch (err: unknown) {
            showToast(false, err instanceof Error ? err.message : 'Action failed.');
        } finally {
            setActionId(null);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Users</h1>
                <p className="text-sm text-slate-500 mt-0.5">{total > 0 ? `${total.toLocaleString()} registered users` : 'User management'}</p>
            </div>

            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard label="Total Users"   value={users.length.toLocaleString()} />
                    <StatsCard label="Administrators" value={totalAdmins.toLocaleString()} />
                    <StatsCard label="Standard Users" value={(users.length - totalAdmins).toLocaleString()} />
                    <StatsCard label="New (30 days)"  value={recentSignups.toLocaleString()} />
                </div>
            )}

            {toast && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border ${toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Search & filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Input icon={Search} placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                    {(['all', 'admin', 'user'] as const).map(role => (
                        <button key={role} onClick={() => setRoleFilter(role)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${roleFilter === role ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>
                            {role === 'all' ? 'All' : role === 'admin' ? 'Admins' : 'Users'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-sm text-rose-500">{error}</div>
                ) : loading ? (
                    <SkeletonRows />
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users size={36} className="mx-auto text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm font-bold text-slate-900">No users found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Joined</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                                    {user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-900">{user.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{user.email}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} size="sm">
                                                {user.role === 'admin' ? 'Admin' : 'User'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.isBanned ? (
                                                <Badge variant="destructive" size="sm">Banned</Badge>
                                            ) : (
                                                <Badge variant="success" size="sm">Active</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={actionId === user.id}
                                                onClick={() => handleBan(user)}
                                                className={`text-xs font-bold rounded-lg ${user.isBanned
                                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                                    : 'text-rose-600 hover:bg-rose-50'}`}
                                            >
                                                {actionId === user.id ? '…' : user.isBanned ? 'Unban' : 'Ban'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
                            Showing {filtered.length} of {users.length} users
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
