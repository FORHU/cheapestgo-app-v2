'use client';

import React from 'react';
import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { convertCurrency } from '@/shared/lib/currency';
import { formatCurrency } from '@/shared/lib/format';
import type { MappableProperty } from '@/shared/components/map/types';

// ─── Geometry constants ───────────────────────────────────────────────────────

const CARD_W      = 196;
const CARD_REF_W  = 320;
const SCALE       = CARD_W / CARD_REF_W;
const px          = (n: number) => Math.round(n * SCALE);
const TYPE_SCALE  = Math.max(SCALE, 0.9);
const fpx         = (n: number) => Math.round(n * TYPE_SCALE * 10) / 10;

export const CARD_IMG_H    = px(160);
export const PRICE_CIRCLE  = px(97);
const PANEL_PAD_X          = px(17);
const PANEL_HEIGHT         = px(124);
export const CARD_H        = CARD_IMG_H + PANEL_HEIGHT;
export const SELECT_SCALE  = 1.15;
export const SELECT_GUTTER = Math.round((CARD_W * (SELECT_SCALE - 1)) / 2);
export const SELECT_HEADROOM = Math.ceil(CARD_H * (SELECT_SCALE - 1));

const AVG_CHAR_EM = 0.54;
const PRICE_PAD   = 8;
const CIRCLE_BLEED = -18;
const NAME_PAD_R   = PRICE_CIRCLE - CIRCLE_BLEED + px(8) - PANEL_PAD_X;

function priceFontFor(label: string): number {
    const room = PRICE_CIRCLE - PRICE_PAD;
    const fitted = room / Math.max(1, label.length * AVG_CHAR_EM);
    return Math.max(6.5, Math.min(fpx(10.5), Math.round(fitted * 10) / 10));
}

// ─── Palette ──────────────────────────────────────────────────────────────────

export function railCardPalette(theme: 'light' | 'dark') {
    const dark = theme === 'dark';
    return {
        surface:   dark ? '#1A1A1A' : '#FFFFFF',
        title:     dark ? '#FFFFFF' : '#111111',
        muted:     dark ? 'rgba(255,255,255,0.60)' : '#6B7280',
        hairline:  dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        imageBg:   dark ? 'rgba(255,255,255,0.05)' : '#F1F1F1',
        chipBg:    dark ? '#FFFFFF' : '#1A1A1A',
        chipText:  dark ? '#111111' : '#FFFFFF',
        chipTrack: dark ? 'rgba(17,17,17,0.20)' : 'rgba(255,255,255,0.20)',
    };
}

// ─── RailCard ─────────────────────────────────────────────────────────────────

interface RailCardProps {
    property: MappableProperty;
    isSelected: boolean;
    isHovered: boolean;
    shiftLeft: number;
    shiftRight: number;
    onSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    onViewDetails: (id: string) => void;
    currency: string;
    theme: 'light' | 'dark';
}

export function RailCard({
    property, isSelected, isHovered, shiftLeft, shiftRight,
    onSelect, onHover, onViewDetails, currency, theme,
}: RailCardProps) {
    const c = railCardPalette(theme);
    const price = convertCurrency(property.price, property.currency || 'USD', currency);
    const priceStr = formatCurrency(price, currency);
    const rating = property.rating ?? 0;
    const enlarged = isSelected || isHovered;
    const priceLine = `${priceStr}/ night`;
    const priceFont = priceFontFor(priceLine);

    return (
        <div
            onClick={() => onSelect(property.id)}
            onMouseEnter={() => onHover(property.id)}
            onMouseLeave={() => onHover(null)}
            className="shrink-0 cursor-pointer"
            style={{
                position: 'relative',
                width: CARD_W, borderRadius: px(16), overflow: 'hidden',
                background: c.surface, border: '', boxShadow: 'none',
                transform: enlarged ? `scale(${SELECT_SCALE})` : 'scale(1)',
                transformOrigin: 'center bottom',
                marginLeft: shiftLeft,
                marginRight: shiftRight,
                zIndex: isSelected ? 5 : isHovered ? 4 : 1,
                transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), margin 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: 'auto',
            }}
        >
            {/* Image */}
            <div style={{ height: CARD_IMG_H, position: 'relative', background: c.imageBg }}>
                {property.image ? (
                    <Image src={property.image} alt={property.name} fill className="object-cover" sizes="320px" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Building2 size={26} style={{ color: c.muted }} />
                    </div>
                )}
                {property.refundableTag === 'RFN' && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: '#2FB67F', zIndex: 2 }}>
                        Free cancel
                    </span>
                )}
            </div>

            {/* Price circle */}
            <div className="absolute flex items-center justify-center" style={{ width: PRICE_CIRCLE, height: PRICE_CIRCLE, borderRadius: '50%', top: CARD_IMG_H - PRICE_CIRCLE / 2, right: -CIRCLE_BLEED, zIndex: 10, background: c.chipBg, boxShadow: '0 2px 12px rgba(0,0,0,0.28)' }}>
                {property.priceLoading ? (
                    <div className="animate-pulse rounded-full" style={{ width: px(42), height: px(11), background: 'rgba(128,128,128,0.35)' }} />
                ) : (
                    <span style={{ fontSize: priceFont, fontWeight: 700, color: c.chipText, whiteSpace: 'nowrap', lineHeight: 1.2, paddingRight: Math.max(0, CIRCLE_BLEED * 2) }}>
                        {priceLine}
                    </span>
                )}
            </div>

            {/* Panel */}
            <div style={{ minHeight: PANEL_HEIGHT, display: 'flex', flexDirection: 'column', padding: `${px(30)}px ${PANEL_PAD_X}px ${px(18)}px`, background: c.surface }}>
                <h3 style={{ fontSize: fpx(14), fontWeight: 700, color: c.title, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: NAME_PAD_R }}>
                    {property.name}
                </h3>
                <p style={{ fontSize: fpx(11), color: c.muted, marginTop: px(4), lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {property.location ?? property.city ?? ' '}
                </p>
                <p style={{ fontSize: fpx(11), color: c.muted, marginTop: px(8), lineHeight: 1.35 }}>
                    {rating > 0 ? `${rating.toFixed(1)} rating` : ' '}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(property.id); }}
                        style={{ background: c.chipBg, color: c.chipText, border: 'none', borderRadius: 100, padding: `${px(10)}px ${px(21)}px`, fontSize: fpx(12), fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                        View Stay
                    </button>
                </div>
            </div>
        </div>
    );
}
