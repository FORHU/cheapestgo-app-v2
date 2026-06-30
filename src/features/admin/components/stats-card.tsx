import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface StatsCardProps {
    label: string;
    value: string | number;
    trend?: number; // percentage, positive = up, negative = down
    prefix?: string;
    suffix?: string;
    className?: string;
}

export function StatsCard({ label, value, trend, prefix, suffix, className }: StatsCardProps) {
    const trendIcon =
        trend === undefined ? null :
        trend > 0  ? <TrendingUp  size={14} className="text-emerald-500" /> :
        trend < 0  ? <TrendingDown size={14} className="text-rose-500" /> :
                     <Minus size={14} className="text-slate-400" />;

    const trendColor =
        trend === undefined ? '' :
        trend > 0  ? 'text-emerald-600' :
        trend < 0  ? 'text-rose-600' :
                     'text-slate-500';

    return (
        <div className={cn(
            'bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm',
            className
        )}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {prefix && <span className="text-base font-semibold text-slate-500 mr-0.5">{prefix}</span>}
                {value}
                {suffix && <span className="text-base font-semibold text-slate-500 ml-0.5">{suffix}</span>}
            </p>
            {trend !== undefined && (
                <div className={cn('flex items-center gap-1 mt-2 text-xs font-semibold', trendColor)}>
                    {trendIcon}
                    <span>{Math.abs(trend)}% vs last month</span>
                </div>
            )}
        </div>
    );
}
