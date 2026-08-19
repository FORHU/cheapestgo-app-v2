import React from 'react';
import { HOTEL_TOKENS, ratingInfo } from '@/features/hotels/types/property.types';
import type { ReviewItem } from '@/features/hotels/types/property.types';
import { ReviewForm } from '@/features/hotels/components/review-form';

interface ReviewSectionProps {
    hotelId: string;
    reviewScore: number;
    reviewCount: number;
    reviewItems: ReviewItem[];
}

export function ReviewSection({ hotelId, reviewScore, reviewCount, reviewItems }: ReviewSectionProps) {
    const rinfo = reviewScore > 0 ? ratingInfo(reviewScore) : null;

    return (
        <section style={{ marginTop: 32 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: HOTEL_TOKENS.TEXT, marginBottom: 16 }}>What guests say</div>

            {/* Overall score summary */}
            {rinfo && reviewScore > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(255,255,255,.07)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: rinfo.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{reviewScore.toFixed(1)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: rinfo.color }}>{rinfo.label}</div>
                        <div style={{ fontSize: 13, color: 'rgba(245,239,228,.55)', marginTop: 2 }}>
                            Based on <span style={{ color: HOTEL_TOKENS.TEXT, fontWeight: 600 }}>{reviewCount}</span> {reviewCount === 1 ? 'review' : 'reviews'}
                        </div>
                    </div>
                </div>
            )}

            {/* Review cards */}
            {reviewItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    {reviewItems.map((item, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,.07)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,107,75,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: HOTEL_TOKENS.ACCENT }}>
                                        {(item.reviewer_name ?? 'A')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: HOTEL_TOKENS.TEXT }}>{item.reviewer_name ?? 'Anonymous'}</div>
                                        {item.country && <div style={{ fontSize: 11, color: 'rgba(245,239,228,.45)' }}>{item.country}</div>}
                                    </div>
                                </div>
                                {item.score != null && (
                                    <div style={{ background: 'rgba(47,182,127,.15)', borderRadius: 6, padding: '3px 8px', fontSize: 13, fontWeight: 700, color: HOTEL_TOKENS.GREEN }}>
                                        {Number(item.score).toFixed(1)}
                                    </div>
                                )}
                            </div>
                            {item.headline && <div style={{ fontSize: 13, fontWeight: 600, color: HOTEL_TOKENS.TEXT, marginBottom: 4 }}>{item.headline}</div>}
                            {item.pros && <div style={{ fontSize: 13, color: 'rgba(245,239,228,.75)' }}>{item.pros}</div>}
                            {item.cons && <div style={{ fontSize: 13, color: 'rgba(245,239,228,.55)', marginTop: 4 }}>{item.cons}</div>}
                        </div>
                    ))}
                </div>
            )}

            <ReviewForm hotelId={hotelId} />
        </section>
    );
}
