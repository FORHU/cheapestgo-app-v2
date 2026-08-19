'use client';

import React, { useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { Map } from '@/shared/components/ui/map';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
import { POI_FILTERS } from '@/shared/config/map-discovery';
import { HOTEL_TOKENS } from '@/features/hotels/types/property.types';
import type { PoiCategory } from '@/shared/config/map-discovery';

interface NearbySectionProps {
    coordinates: { lat: number; lng: number };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R    = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
               + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryDotColor(cat: string): string {
    const c = cat.toLowerCase();
    if (c.includes('park') || c.includes('garden') || c.includes('nature'))      return '#10b981';
    if (c.includes('restaurant') || c.includes('cafe') || c.includes('food') || c.includes('bar')) return '#f97316';
    if (c.includes('museum') || c.includes('landmark') || c.includes('attraction')) return '#818cf8';
    if (c.includes('shop') || c.includes('market'))                               return '#ec4899';
    if (c.includes('hospital') || c.includes('pharmacy'))                         return '#60a5fa';
    return '#94a3b8';
}

function formatCategory(cat: string) {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NearbySection({ coordinates }: NearbySectionProps) {
    const [category, setCategory] = useState<PoiCategory>('all');
    const [activeId, setActiveId] = useState<string | null>(null);
    const { gems, loading } = useNearbyGems({ coordinates, category, radiusMeters: 2000 });
    const topGems = gems.slice(0, 5);

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
                {POI_FILTERS.map((f) => {
                    const active = category === f.id;
                    const Icon   = f.icon;
                    return (
                        <button
                            key={f.id}
                            onClick={() => { setCategory(f.id); setActiveId(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer', background: active ? HOTEL_TOKENS.ACCENT : 'rgba(255,255,255,.07)', color: active ? '#fff' : 'rgba(245,239,228,.6)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', transition: 'background .15s, color .15s', flexShrink: 0 }}
                        >
                            <Icon size={12} />
                            {f.id === 'all' ? 'All' : formatCategory(f.id)}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 16, minHeight: 220 }}>
                <div style={{ width: '42%', height: 220, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: '#1e293b' }}>
                    <Map
                        mapStyle="mapbox://styles/mapbox/dark-v11"
                        initialViewState={{ longitude: coordinates.lng, latitude: coordinates.lat, zoom: 14 }}
                        scrollZoom={false}
                        className="rounded-2xl"
                    >
                        <Marker longitude={coordinates.lng} latitude={coordinates.lat} anchor="center">
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: HOTEL_TOKENS.ACCENT, border: '2.5px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.55)' }} />
                        </Marker>
                        {topGems.map((gem) => {
                            const isActive = activeId === gem.id;
                            const dot = categoryDotColor(gem.category);
                            return (
                                <Marker key={gem.id} longitude={gem.coordinates.lng} latitude={gem.coordinates.lat} anchor="center" onClick={() => setActiveId(isActive ? null : gem.id)}>
                                    <div style={{ width: isActive ? 14 : 9, height: isActive ? 14 : 9, borderRadius: '50%', background: dot, border: isActive ? '2px solid #fff' : '1.5px solid rgba(255,255,255,.75)', boxShadow: isActive ? `0 0 0 3px ${dot}55` : '0 1px 4px rgba(0,0,0,.4)', cursor: 'pointer', transition: 'all .15s' }} />
                                </Marker>
                            );
                        })}
                    </Map>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {loading && topGems.length === 0 && (
                        <p style={{ color: 'rgba(245,239,228,.3)', fontSize: 13 }}>Loading nearby places…</p>
                    )}
                    {!loading && topGems.length === 0 && (
                        <p style={{ color: 'rgba(245,239,228,.3)', fontSize: 13 }}>No places found nearby.</p>
                    )}
                    {topGems.map((gem, i) => {
                        const dist     = haversine(coordinates.lat, coordinates.lng, gem.coordinates.lat, gem.coordinates.lng);
                        const Icon     = gem.icon;
                        const dot      = categoryDotColor(gem.category);
                        const isActive = activeId === gem.id;
                        return (
                            <div
                                key={gem.id}
                                onClick={() => setActiveId(isActive ? null : gem.id)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 8px', borderRadius: 10, cursor: 'pointer', borderBottom: i < topGems.length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none', background: isActive ? 'rgba(255,255,255,.06)' : 'transparent', transition: 'background .15s' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 10, background: isActive ? `${dot}22` : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                                        <Icon size={15} color={dot} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: '#fff', lineHeight: 1.25 }}>{gem.name}</div>
                                        <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)', marginTop: 2 }}>
                                            {formatCategory(gem.displayCategory || gem.category)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, paddingLeft: 12, flexShrink: 0 }}>
                                    {gem.rating !== null && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,239,228,.8)' }}>{Number(gem.rating).toFixed(1)}</span>
                                        </div>
                                    )}
                                    <div style={{ fontSize: 12, color: 'rgba(245,239,228,.45)', fontWeight: 600 }}>
                                        {dist.toFixed(1)} mi
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
