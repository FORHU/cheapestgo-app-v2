'use client';

import React, { useState } from 'react';
import { HOTEL_TOKENS } from '@/features/hotels/types/property.types';
import type { RoomOption } from '@/features/hotels/types/property.types';
import { convertCurrency, getCurrencySymbol } from '@/shared/lib/currency';
import { useUserCurrency } from '@/shared/stores/search.store';

const INITIAL_VISIBLE = 4;

interface RoomSelectorProps {
    rooms: RoomOption[];
    selectedRoomId: string | null;
    onSelect: (id: string | null) => void;
}

function boardLabel(boardType: string | undefined): string | null {
    if (!boardType) return null;
    if (['BB', 'HB', 'FB', 'AI'].includes(boardType)) return 'Breakfast included';
    return null;
}

export function RoomSelector({ rooms, selectedRoomId, onSelect }: RoomSelectorProps) {
    const [expanded, setExpanded] = useState(false);
    const currency = useUserCurrency();
    const symbol = getCurrencySymbol(currency);
    const visible = expanded ? rooms : rooms.slice(0, INITIAL_VISIBLE);
    const hidden = rooms.length - INITIAL_VISIBLE;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map((room) => {
                const isSelected = room.id === selectedRoomId;
                const price = convertCurrency(room.price, room.currency as never, currency as never);
                const isRefundable = room.refundableTag === 'RFN';
                const breakfast = boardLabel(room.boardType);

                return (
                    <div
                        key={room.id}
                        style={{ background: isSelected ? 'rgba(255,107,75,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${isSelected ? HOTEL_TOKENS.ACCENT : 'rgba(255,255,255,.08)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: HOTEL_TOKENS.TEXT }}>{room.name}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                {isRefundable && (
                                    <span style={{ background: 'rgba(47,182,127,.15)', color: '#2FB67F', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>Free cancellation</span>
                                )}
                                {breakfast && (
                                    <span style={{ background: 'rgba(255,107,75,.15)', color: HOTEL_TOKENS.ACCENT, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>{breakfast}</span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: HOTEL_TOKENS.ACCENT }}>
                                {symbol}{Math.round(price).toLocaleString()}
                            </div>
                            <button
                                onClick={() => onSelect(isSelected ? null : room.id)}
                                style={{ background: isSelected ? HOTEL_TOKENS.ACCENT : 'rgba(255,107,75,.15)', color: isSelected ? '#fff' : HOTEL_TOKENS.ACCENT, border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                            >
                                {isSelected ? 'Selected' : 'Select'}
                            </button>
                        </div>
                    </div>
                );
            })}

            {rooms.length > INITIAL_VISIBLE && (
                <button
                    onClick={() => setExpanded((e) => !e)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, color: 'rgba(245,239,228,.65)', fontSize: 13, fontWeight: 600, padding: '10px 0', cursor: 'pointer' }}
                >
                    {expanded ? 'Show less' : `Show ${hidden} more room${hidden > 1 ? 's' : ''}`}
                </button>
            )}
        </div>
    );
}
