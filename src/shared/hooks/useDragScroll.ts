'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Enables click-and-drag horizontal scrolling on an `overflow-x-auto` element,
 * so a plain mouse can swipe the row left/right (and back) without a scrollbar.
 *
 * Smoothness:
 *  - Scroll writes are coalesced into a single `requestAnimationFrame` per frame
 *    (a high-Hz mouse fires move events faster than the display refreshes).
 *  - On release the row keeps gliding with friction (momentum), then eases into
 *    the nearest scroll-snap point — no abrupt stop and no jump-snap.
 *
 * Touch is left to the browser's native momentum scrolling — we only drive
 * mouse/pen pointers. After a drag, the next click is suppressed so dragging
 * across a card doesn't trigger its navigation.
 *
 * Usage:
 *   const { ref, dragProps } = useDragScroll<HTMLDivElement>();
 *   <div ref={ref} {...dragProps} className="flex overflow-x-auto …">…</div>
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const drag = useRef({
    down: false,
    moved: false,
    startX: 0,
    startScroll: 0,
    target: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0, // scroll px per ms (negative = content moving right)
  });
  const moveRaf = useRef<number | null>(null);
  const glideRaf = useRef<number | null>(null);

  // ── Frame-batched scroll write during an active drag ──────────────────────
  const flushScroll = useCallback(() => {
    moveRaf.current = null;
    const el = ref.current;
    if (el) el.scrollLeft = drag.current.target;
  }, []);

  const cancelGlide = useCallback(() => {
    if (glideRaf.current != null) {
      cancelAnimationFrame(glideRaf.current);
      glideRaf.current = null;
    }
  }, []);

  const setSnap = useCallback((value: string) => {
    const el = ref.current;
    if (el) el.style.scrollSnapType = value;
  }, []);

  // ── Ease to the nearest snap point, then hand control back to CSS snap ─────
  const settle = useCallback(() => {
    const el = ref.current;
    if (!el) { return; }

    const max = el.scrollWidth - el.clientWidth;
    const padLeft = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
    const base = el.getBoundingClientRect().left;
    let target = el.scrollLeft;
    let bestDist = Infinity;
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const childLeft = child.getBoundingClientRect().left - base + el.scrollLeft;
      const candidate = Math.max(0, Math.min(childLeft - padLeft, max));
      const dist = Math.abs(candidate - el.scrollLeft);
      if (dist < bestDist) { bestDist = dist; target = candidate; }
    }

    const from = el.scrollLeft;
    const dist = target - from;
    if (Math.abs(dist) < 1) { el.scrollLeft = target; setSnap(''); return; }

    const duration = 260;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      el.scrollLeft = from + dist * easeOutCubic(t);
      if (t < 1) {
        glideRaf.current = requestAnimationFrame(tick);
      } else {
        glideRaf.current = null;
        setSnap(''); // restore CSS scroll-snap now that we sit exactly on a point
      }
    };
    glideRaf.current = requestAnimationFrame(tick);
  }, [setSnap]);

  // ── Friction-based momentum after release, then settle ─────────────────────
  const runMomentum = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    let velocity = drag.current.velocity;
    const friction = 0.94;
    const step = () => {
      velocity *= friction;
      if (Math.abs(velocity) < 0.05) { settle(); return; }
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + velocity * 16; // ~px this frame at 60fps
      if (next <= 0) { el.scrollLeft = 0; settle(); return; }
      if (next >= max) { el.scrollLeft = max; settle(); return; }
      el.scrollLeft = next;
      glideRaf.current = requestAnimationFrame(step);
    };
    glideRaf.current = requestAnimationFrame(step);
  }, [settle]);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    if (e.pointerType === 'touch') return; // native momentum handles touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelGlide();
    const d = drag.current;
    d.down = true;
    d.moved = false;
    d.startX = e.clientX;
    d.startScroll = el.scrollLeft;
    d.target = el.scrollLeft;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp || performance.now();
    d.velocity = 0;
  }, [cancelGlide]);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d.down) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setSnap('none'); // free movement while dragging
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const now = e.timeStamp || performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const instV = (e.clientX - d.lastX) / dt; // pointer px/ms
      // Scroll moves opposite the pointer; smooth to damp jitter.
      d.velocity = d.velocity * 0.3 + (-instV) * 0.7;
      d.lastX = e.clientX;
      d.lastT = now;
    }
    d.target = d.startScroll - dx;
    if (moveRaf.current == null) moveRaf.current = requestAnimationFrame(flushScroll);
  }, [flushScroll, setSnap]);

  const endDrag = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    if (el?.hasPointerCapture?.(e.pointerId)) {
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    // Flush any pending drag frame so momentum starts from the true position.
    if (moveRaf.current != null) {
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = null;
      if (el) el.scrollLeft = d.target;
    }
    if (!d.moved) { setSnap(''); return; } // a plain click — ensure snap is on
    if (Math.abs(d.velocity) > 0.05) runMomentum();
    else settle();
  }, [runMomentum, settle, setSnap]);

  // Swallow the click that fires at the end of a drag so cards don't navigate.
  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }, []);

  useEffect(() => () => {
    if (moveRaf.current != null) cancelAnimationFrame(moveRaf.current);
    if (glideRaf.current != null) cancelAnimationFrame(glideRaf.current);
  }, []);

  return {
    ref,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}
