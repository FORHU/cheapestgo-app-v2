import React from 'react';
import { Building2 } from 'lucide-react';
import { railCardPalette } from '@/features/search/components/rail-card';

interface StatusScreenProps {
    busy?: boolean;
    title: string;
    lines: string[];
    action?: { label: string; onClick: () => void };
    theme: 'light' | 'dark';
}

export function StatusScreen({ busy, title, lines, action, theme }: StatusScreenProps) {
    const c = railCardPalette(theme);

    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center text-center" style={{ background: c.surface }}>
            <div className="relative flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: c.chipBg }}>
                {busy && (
                    <span
                        aria-hidden="true"
                        className="absolute animate-spin rounded-full"
                        style={{ inset: 5, border: `2px solid ${c.chipTrack}`, borderTopColor: c.chipText, animationDuration: '0.9s' }}
                    />
                )}
                <Building2 size={24} style={{ color: c.chipText }} />
            </div>

            <p style={{ fontSize: 19, fontWeight: 500, color: c.title, marginTop: 20 }}>{title}</p>

            {lines.map((line, i) => (
                <p key={line} style={{ fontSize: 13, color: c.muted, lineHeight: 1.4, marginTop: i === 0 ? 10 : 6 }}>
                    {line}
                </p>
            ))}

            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="inline-flex items-center justify-center cursor-pointer transition-opacity hover:opacity-85"
                    style={{ marginTop: 32, height: 62, padding: '0 52px', background: c.chipBg, color: c.chipText, border: 'none', borderRadius: 100, fontSize: 17, fontWeight: 500, boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
