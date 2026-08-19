import React from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { HOTEL_TOKENS, ratingInfo } from '@/features/hotels/types/property.types';

interface PropertyHeroProps {
    name: string;
    city: string | null;
    country: string | null;
    heroImage: string | null;
    reviewScore: number;
    reviewCount: number;
    saved: boolean;
    onBack: () => void;
    onSave: () => void;
}

export function PropertyHero({
    name, city, country, heroImage,
    reviewScore, reviewCount,
    saved, onBack, onSave,
}: PropertyHeroProps) {
    const rinfo = ratingInfo(reviewScore);

    return (
        <div style={{ position: 'relative', height: '58vh', minHeight: 320 }}>
            {heroImage ? (
                <img
                    src={heroImage}
                    alt={name}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <div style={{ position: 'absolute', inset: 0, background: '#22383A' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(10,8,14,.15) 0%,rgba(10,8,14,.25) 45%,rgba(10,8,14,.85) 100%)' }} />

            {/* Back */}
            <button
                onClick={onBack}
                aria-label="Back"
                style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
                <ArrowLeft size={16} />
            </button>

            {/* Heart */}
            <button
                onClick={onSave}
                aria-label={saved ? 'Unsave' : 'Save'}
                style={{ position: 'absolute', top: 20, right: reviewScore > 0 ? 90 : 20, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
                <Heart size={18} fill={saved ? HOTEL_TOKENS.ACCENT : 'none'} stroke={saved ? HOTEL_TOKENS.ACCENT : '#fff'} />
            </button>

            {/* Rating stamp */}
            {reviewScore > 0 && (
                <div style={{ position: 'absolute', top: 20, right: 20, width: 58, height: 58, borderRadius: '50%', background: rinfo.color, color: '#fff', border: '2px dashed rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{reviewScore.toFixed(1)}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 1 }}>{rinfo.label}</div>
                </div>
            )}

            {/* Name + location */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'clamp(20px,4vw,40px)' }}>
                <div style={{ fontFamily: "var(--font-fredoka), 'Fredoka', sans-serif", fontWeight: 600, fontSize: 'clamp(26px,4vw,44px)', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
                    {name}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', marginTop: 6 }}>
                    {[city, country].filter(Boolean).join(' · ')}
                    {reviewCount > 0 ? ` · ${reviewCount.toLocaleString()} reviews` : ''}
                </div>
            </div>
        </div>
    );
}
