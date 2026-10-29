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

    // Dense by design: these sit four-across above a table that is the actual subject of the
    // page, so the number is readable at a glance without the card claiming a fifth of the
    // screen. The old 20px padding and 24px figure pushed every table below the fold.
    return (
        <div className={cn(
            'bg-white rounded-lg border border-slate-200 px-3.5 py-2.5',
            className
        )}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums leading-tight">
                {prefix && <span className="text-xs font-medium text-slate-500 mr-0.5">{prefix}</span>}
                {value}
                {suffix && <span className="text-xs font-medium text-slate-500 ml-0.5">{suffix}</span>}
            </p>
            {trend !== undefined && (
                <div className={cn('flex items-center gap-1 mt-0.5 text-[11px] font-medium', trendColor)}>
                    {trendIcon}
                    <span>{Math.abs(trend)}% vs last month</span>
                </div>
            )}
        </div>
    );
}
