// DEMO ONLY — TelemetryCard renders mock flight/weather data for UI demonstration purposes.
// Values like "BA0178", "72°", "45% humidity" are illustrative and not sourced from a live API.
import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Plane, Sun, Cloud, CloudSun, TrendingDown } from 'lucide-react';
import { TelemetryData } from '../../../types';

export const StatusBadge = () => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">System Nominal</span>
    </div>
);

export const VersionBadge = () => (
    <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border dark:border-obsidian-accent/20 border-alabaster-accent/20 dark:bg-obsidian-accent/5 bg-alabaster-accent/5 shadow-sm"
    >
        <Activity className="w-3 h-3 dark:text-obsidian-accent text-alabaster-accent" />
        <span className="text-xs font-display font-semibold dark:text-obsidian-accent text-alabaster-accent tracking-widest uppercase">Smart Price Tracking</span>
    </motion.div>
);

export const TelemetryCard: React.FC<{ data: TelemetryData }> = ({ data }) => {
    return (
        <div className="relative overflow-hidden p-6 rounded-lg 
      bg-white/60 dark:bg-white/5 
      backdrop-blur-xl border border-slate-200/50 dark:border-white/10
      shadow-lg hover:shadow-xl transition-all duration-300 group
    ">
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{data.label}</span>
                    <h3 className="text-[clamp(0.9375rem,2vw,1.125rem)] font-display font-bold text-slate-900 dark:text-white">{data.value}</h3>
                </div>
                <div className={`p-1.5 rounded-md ${data.trend === 'down' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    'bg-alabaster-accent/10 text-alabaster-accent dark:bg-obsidian-accent/10 dark:text-obsidian-accent'
                    }`}>
                    {data.icon === 'chart' && <TrendingDown size={18} />}
                    {data.icon === 'plane' && <Plane size={18} />}
                    {data.icon === 'sun' && <Sun size={18} />}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {data.trend === 'down' ? (
                    <>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[clamp(1.25rem,4vw,1.875rem)] font-mono font-medium text-slate-900 dark:text-white">{data.value}</span>
                            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">{data.subValue}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden mt-2">
                            <div className="bg-emerald-500 h-full w-[75%]"></div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-mono">24h Low detected. Buy advised.</p>
                    </>
                ) : data.icon === 'plane' ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Flight</span>
                            <span className="font-mono text-slate-900 dark:text-white">BA0178</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Gate</span>
                            <span className="font-mono text-slate-900 dark:text-white">A12 <span className="text-emerald-500 text-[10px] ml-1">CONFIRMED</span></span>
                        </div>
                        <button className="mt-2 w-full py-2 bg-slate-900 dark:bg-slate-800 hover:opacity-90 border border-slate-700 dark:border-slate-600 rounded text-xs font-display font-semibold text-white transition-colors">
                            View Boarding Pass
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="text-[clamp(1.5rem,5vw,2.25rem)] font-display font-bold text-slate-900 dark:text-white">72°</div>
                            <div className="flex flex-col text-xs text-slate-500 font-mono">
                                <span>HUM: 45%</span>
                                <span>VIS: 10mi</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-10 bg-black/5 dark:bg-white/5 rounded flex flex-col items-center justify-center border border-black/5 dark:border-white/5">
                                    <span className="text-[8px] text-slate-400 font-mono">{i}PM</span>
                                    {i < 3 ? <Sun size={10} className="text-amber-500" /> : <CloudSun size={10} className="text-slate-400" />}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
