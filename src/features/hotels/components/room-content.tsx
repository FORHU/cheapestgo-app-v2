'use client';

import React from 'react';
import {
    AirVent, Baby, Bath, Bed, Building2, Check, Coffee, Droplets, Lock, PanelTop,
    Phone, Refrigerator, Shirt, Tv, UtensilsCrossed, Wifi, Wind, Cigarette,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { DetailItem, DetailSection, IconId } from '@/features/hotels/types/property.types';

/**
 * One lucide glyph per `IconId` the API can send. `Record<IconId, …>` makes a
 * missing key a compile error, so the FE can never receive an icon it cannot draw.
 */
const SECTION_ICONS: Record<IconId, LucideIcon> = {
    bath: Bath, shower: Bath, toiletries: Droplets, fridge: Refrigerator, coffee: Coffee,
    kitchen: UtensilsCrossed, wifi: Wifi, phone: Phone, tv: Tv, wardrobe: Shirt,
    desk: PanelTop, window: PanelTop, safe: Lock, ac: AirVent, heating: Wind,
    smoking: Cigarette, bed: Bed, view: Building2, child: Baby, check: Check,
};

function iconFor(key?: IconId): LucideIcon {
    return (key && SECTION_ICONS[key]) || Check;
}

interface PaletteLike {
    feature: string;
    columnHeading?: string;
    empty?: string;
}

/**
 * The modal's headerless "key facts" strip — bed/size/smoking/internet/etc. drawn
 * as a two-column list of icon rows, matching the reference design.
 */
export function KeyFactsRow({ facts, palette }: { facts: DetailItem[]; palette: PaletteLike }) {
    if (!facts.length) return null;
    return (
        <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {facts.map((f, i) => {
                const Icon = iconFor(f.icon);
                return (
                    <li key={`${f.label}-${i}`} className={cn('flex items-center gap-2 text-[15px]', palette.feature)}>
                        <Icon size={17} strokeWidth={1.75} className="shrink-0" />
                        <span className="min-w-0">{f.label}</span>
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * The categorised body: one `<h4>` header per section over a column of icon rows,
 * sections flowing in a responsive auto-grid (several across when the modal is
 * wide, stacked when narrow). An item's `note` (a price, "on request") trails it.
 */
export function DetailSectionGrid({ sections, palette }: { sections: DetailSection[]; palette: PaletteLike }) {
    if (!sections.length) return null;
    return (
        <div className="grid gap-x-8 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {sections.map((section) => (
                <div key={section.id} className="min-w-0">
                    <h4 className={cn('text-[15px] font-semibold', palette.columnHeading)}>{section.title}</h4>
                    <ul className="mt-2 flex flex-col gap-2">
                        {section.items.map((item, i) => {
                            const Icon = iconFor(item.icon);
                            return (
                                <li key={`${item.label}-${i}`} className={cn('flex items-start gap-2 text-[14px]', palette.feature)}>
                                    <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">
                                        {item.label}
                                        {item.note && (
                                            <span className={cn('ml-1.5 text-[13px]', palette.empty)}>{item.note}</span>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
