import { Tag } from 'lucide-react';

export default function AdminDealsPage() {
    return (
        <div className="p-6">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Deals</h1>
                <p className="text-sm text-slate-500 mt-0.5">Manage vouchers, flight deals, and hotel offers</p>
            </div>

            <div className="mt-24 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Tag size={28} className="text-slate-400" />
                </div>
                <div>
                    <p className="text-base font-semibold text-slate-700">Hotel deals management coming soon</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-xs">
                        Voucher management, flight deals, and hotel promotions will be available in a future update.
                    </p>
                </div>
            </div>
        </div>
    );
}
