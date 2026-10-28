'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/components/ThemeContext';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import type { Palette } from '@/features/checkout/lib/palette';

/**
 * The row above the heading: back on the left; currency, then theme, on the
 * right — 50px discs on the raised `surface`, as on the property page's banner
 * but solid, since here they sit on the page rather than over a photograph.
 */
export function CheckoutToolbar({ palette, backLabel, onBack }: { palette: Palette; backLabel: string; onBack: () => void }) {
    const tAll = useTranslations();
    const { theme, toggleTheme } = useTheme();
    const disc: React.CSSProperties = {
        width: 50, height: 50, borderRadius: '50%', border: 'none',
        background: palette.surface, color: palette.title,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    };
    return (
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(24px,3vw,36px)' }}>
            <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} style={disc}>
                <ChevronLeft size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 17 }}>
                <CurrencySelector
                    align="right"
                    iconOnly
                    triggerClassName="h-[50px] w-[50px] md:h-[50px] md:w-[50px]"
                    chrome={{
                        surface: palette.surface,
                        border:  'transparent',
                        text:    palette.title,
                        menu:    palette.menuBg,
                        hover:   palette.fieldBg,
                        shadow:  '0 24px 55px -18px rgba(0,0,0,.5)',
                    }}
                />
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? tAll('property.v2.switchToLight') : tAll('property.v2.switchToDark')}
                    title={theme === 'dark' ? tAll('property.v2.lightMode') : tAll('property.v2.darkMode')}
                    style={disc}
                >
                    {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
                </button>
            </div>
        </div>
    );
}
