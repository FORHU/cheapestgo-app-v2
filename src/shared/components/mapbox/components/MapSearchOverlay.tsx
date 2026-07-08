'use client';

import React from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapboxSearch, type SearchResult } from '../hooks/useMapboxSearch';

interface MapSearchOverlayProps {
    onSelect: (result: SearchResult) => void;
    className?: string;
}

export const MapSearchOverlay = ({ onSelect, className = 'absolute top-3 left-3 z-10 w-[72%]' }: MapSearchOverlayProps) => {
    const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | undefined>();

    React.useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn('Geolocation failed:', err),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
        );
    }, []);

    const {
        originQuery, originResults, showOriginResults, setShowOriginResults,
        isSearching, handleOriginSearch, handleSelectOrigin, clearSearch,
    } = useMapboxSearch({ proximity: userLocation });

    const handlePick = (result: SearchResult) => {
        handleSelectOrigin(result);
        onSelect(result);
    };

    return (
        <div className={className}>
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-md shadow-lg pointer-events-auto">
                <div className="flex items-center gap-1.5 px-2.5 h-[30px]">
                    {isSearching ? (
                        <div className="relative w-3.5 h-3.5 shrink-0">
                            <div className="absolute inset-0 border-2 border-blue-100 dark:border-blue-900/30 rounded-full" />
                            <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <Search size={13} className="text-slate-400 shrink-0" />
                    )}
                    <input
                        type="text"
                        value={originQuery}
                        onChange={(e) => handleOriginSearch(e.target.value)}
                        onBlur={() => setTimeout(() => setShowOriginResults(false), 150)}
                        onFocus={() => originResults.length > 0 && setShowOriginResults(true)}
                        placeholder="Search on map…"
                        className="flex-1 text-[11px] text-slate-800 dark:text-slate-200 bg-transparent placeholder:text-[10.5px] placeholder-slate-400 focus:outline-none"
                    />
                    {originQuery && (
                        <button onClick={clearSearch} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={13} />
                        </button>
                    )}
                </div>

                <AnimatePresence>
                    {showOriginResults && originResults.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="max-h-48 overflow-y-auto rounded-b-xl"
                        >
                            {originResults.map((r, i) => (
                                <motion.button
                                    key={r.id}
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    onMouseDown={() => handlePick(r)}
                                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                >
                                    <MapPin size={10} className="text-slate-400 shrink-0" />
                                    <span className="line-clamp-1">{r.name}</span>
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
