'use client';

import React, { useState } from 'react';
import { HOTEL_TOKENS } from '@/features/hotels/types/property.types';

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

interface ReviewFormProps {
    hotelId: string;
}

export function ReviewForm({ hotelId }: ReviewFormProps) {
    const [stars, setStars] = useState(0);
    const [hover, setHover] = useState(0);
    const [body, setBody] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const canSubmit = stars > 0 && body.trim().length > 0;

    async function handleSubmit() {
        setStatus('loading');
        try {
            const res = await fetch(`/api/hotels/${hotelId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stars, body }),
            });
            setStatus(res.ok ? 'success' : 'error');
        } catch {
            setStatus('error');
        }
    }

    if (status === 'success') {
        return (
            <div style={{ background: 'rgba(47,182,127,.12)', border: `1px solid ${HOTEL_TOKENS.GREEN}`, borderRadius: 12, padding: '20px 24px', textAlign: 'center', color: HOTEL_TOKENS.GREEN, fontWeight: 600 }}>
                Thank you for your review!
            </div>
        );
    }

    return (
        <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: HOTEL_TOKENS.TEXT, marginBottom: 14 }}>Share your experience</div>

            {/* Stars */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        onClick={() => setStars(n)}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 24, lineHeight: 1, color: n <= (hover || stars) ? '#F5C518' : 'rgba(255,255,255,.25)' }}
                    >
                        ★
                    </button>
                ))}
            </div>

            {/* Star label */}
            {(hover || stars) > 0 && (
                <div style={{ fontSize: 13, color: 'rgba(245,239,228,.6)', marginBottom: 10 }}>
                    {STAR_LABELS[(hover || stars) - 1]}
                </div>
            )}

            <textarea
                placeholder="Tell others about your stay..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                style={{ width: '100%', resize: 'vertical', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: HOTEL_TOKENS.TEXT, fontSize: 14, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }}
            />

            {status === 'error' && (
                <div style={{ fontSize: 13, color: '#E07070', marginTop: 6 }}>Something went wrong. Please try again.</div>
            )}

            <button
                onClick={handleSubmit}
                disabled={!canSubmit || status === 'loading'}
                style={{ marginTop: 10, background: canSubmit ? HOTEL_TOKENS.ACCENT : 'rgba(255,255,255,.12)', color: canSubmit ? '#fff' : 'rgba(255,255,255,.35)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default', width: '100%' }}
            >
                {status === 'loading' ? 'Posting…' : 'Post review'}
            </button>
        </div>
    );
}
