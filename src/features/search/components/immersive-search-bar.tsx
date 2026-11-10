'use client';

import { useTranslations } from 'next-intl';
import React, { useState, useCallback } from 'react';
import { BRAND } from '@/shared/lib/palette';
import { GolfSentence } from '@/features/golf/components/golf-sentence';
import type { GolfCourse } from '@/features/golf/types';
import { StepSearch, type StayPick } from './step-search';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'stays' | 'flights' | 'golf';

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * The landing search: three tabs, and under them the search for the tab that is on.
 *
 * Stays and Flights ask one question at a time (`step-search.tsx`), where they used to be a
 * fill-in-the-blank sentence. Golf keeps its sentence (`golf-sentence.tsx`), built from the pieces
 * in `prose-parts.tsx`; the keyframes and rules those pieces use are still declared here, once,
 * for whichever sentence is on show.
 */
export function ImmersiveSearchBar({
    defaultMode = 'stays',
    onModeSelect,
    stayPicks,
    golfCourses,
    coursePick,
    onCourseChange,
}: {
    /** The cities Stays offers as picture tiles before anything is typed. */
    stayPicks?: StayPick[];
    /**
     * Golf's courses, for its sentence: `null` while loading, `[]` for none. Left out, the golf
     * sentence asks for them itself — the case for a bar switched to Golf in place, which nobody
     * handed a catalogue.
     */
    golfCourses?: GolfCourse[] | null;
    /** A course chosen outside the bar — the landing page's course pills. */
    coursePick?: { slug: string } | null;
    /** Told which course the golf sentence holds, so the pill for it can light. */
    onCourseChange?: (slug: string | null) => void;
    /**
     * When given, picking another tab calls this instead of switching in place. The landing
     * Journey uses it to slide its panel to that tab's face, whose own bar opens on that mode.
     */
    onModeSelect?: (mode: Mode) => void;
    /**
     * Which tab the bar opens on. The landing Journey mounts one bar per face — stays,
     * flights, golf — and each pins the mode it is about. The tabs still work.
     */
    defaultMode?: Mode;
}) {
    const tAll = useTranslations();
    const [mode, setMode] = useState<Mode>(defaultMode);

    const handleSetMode = useCallback((m: Mode) => (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onModeSelect) {
            if (m !== mode) onModeSelect(m);
            return;
        }
        setMode(m);
    }, [onModeSelect, mode]);

    return (
        <>
            <style>{`
                @keyframes immSbSpin   { to { transform: rotate(360deg); } }
                @keyframes immSbShake  { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(3px)} 30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)} }
                @keyframes immSbPulse  { 0%,100%{box-shadow:0 16px 30px -10px rgba(37,99,235,.55),0 0 0 0 rgba(96,165,250,.45)} 50%{box-shadow:0 16px 30px -10px rgba(37,99,235,.55),0 0 0 10px rgba(96,165,250,0)} }
                @keyframes immSbHint   { 0%,100%{opacity:.92} 50%{opacity:.45} }
                @keyframes immSbBounce { 0%,40%,100%{transform:translateY(0)} 12%{transform:translateY(-7px)} 24%{transform:translateY(0)} 32%{transform:translateY(-3px)} }
                @keyframes immSbSheen  { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
                .imm-token-caret  { animation:immSbBounce 2.4s ease-in-out infinite }
                .imm-token:hover  { opacity:.85 }
                .imm-token:hover .imm-token-caret { animation:none; transform:translateY(2px) }
                @media (prefers-reduced-motion:reduce) { .imm-token-caret { animation:none } }
                .imm-stamp:not([aria-busy="true"]):hover { filter:brightness(0.88) }
                .imm-stamp[aria-busy="true"]::after {
                  content:''; position:absolute; inset:0; pointer-events:none;
                  background:linear-gradient(100deg,transparent 25%,rgba(255,255,255,.28) 50%,transparent 75%);
                  animation:immSbSheen 1.3s ease-in-out infinite;
                }
                @media (prefers-reduced-motion:reduce) { .imm-stamp[aria-busy="true"]::after { animation:none; opacity:0 } }
                .imm-row:hover    { background:rgba(255,255,255,.07);border-radius:14px }
                /* Below 760px a panel is a bottom sheet (NotePanel); it rises rather than appears. */
                @keyframes immSbSheetIn { from{transform:translateY(100%)} to{transform:none} }
                @keyframes immSbFadeIn  { from{opacity:0} to{opacity:1} }
                .imm-sheet          { animation:immSbSheetIn .28s cubic-bezier(.2,.8,.2,1) }
                .imm-sheet-backdrop { animation:immSbFadeIn .2s ease }
                @media (prefers-reduced-motion:reduce) { .imm-sheet, .imm-sheet-backdrop { animation:none } }
                /* A phone. The search lines up with the stage heading above it (the panel's
                   own gutter is enough), sits closer together, and its pieces shrink with it.
                   Read by the inline styles below and in prose-parts through their fallbacks. */
                @media (max-width:640px) {
                  .imm-bar {
                    --imm-pad:0px; --imm-gap:14px; --imm-min-h:0px;
                    --imm-tab-pad:9px 18px; --imm-tab-size:13px;
                    --imm-caret:1.2rem; --imm-go-h:50px;
                  }
                }
            `}</style>

            <div className="imm-bar" style={{ width: '100%', maxWidth: '900px', position: 'relative', margin: '0 auto' }}>
                {/* Transparent: the search sits straight on the page canvas, with no surface,
                    wash or border of its own. */}
                <div style={{
                    // Only enough floor to stop the block jumping as the search changes size
                    // between modes and steps.
                    position: 'relative', width: '100%',
                    minHeight: 'var(--imm-min-h,clamp(220px,26vw,320px))',
                    color: '#fff',
                }}>
                    <div style={{ position: 'relative', minHeight: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--imm-pad,clamp(28px,4.5vw,48px))', gap: 'var(--imm-gap,18px)', boxSizing: 'border-box' }}>

                        {/* ── Mode tabs ── */}
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(2,6,23,.35)', border: `1px solid ${BRAND.glassBorder}`, backdropFilter: 'blur(24px)', borderRadius: '100px', padding: '4px', gap: '2px' }}>
                            {(['stays', 'flights', 'golf'] as Mode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={handleSetMode(m)}
                                    style={{
                                        padding: 'var(--imm-tab-pad,7px 16px)', borderRadius: '100px', border: 'none',
                                        fontSize: 'var(--imm-tab-size,12px)', fontWeight: 700, letterSpacing: '.04em',
                                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                        background: mode === m ? BRAND.gradient : 'transparent',
                                        color:      mode === m ? '#fff' : 'rgba(255,255,255,.85)',
                                        boxShadow:  mode === m ? '0 6px 18px -6px rgba(37,99,235,.65)' : 'none',
                                        transition: 'color .2s,box-shadow .2s',
                                        textTransform: 'capitalize',
                                    }}
                                >{tAll(`landing.search.searchMode.${m}`)}</button>
                            ))}
                        </div>

                        {mode === 'golf' ? (
                            <GolfSentence courses={golfCourses} coursePick={coursePick} onCourseChange={onCourseChange} />
                        ) : (
                            // Keyed by mode: a tab switched in place starts its own search afresh.
                            <StepSearch key={mode} mode={mode} picks={mode === 'stays' ? stayPicks : undefined} />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
