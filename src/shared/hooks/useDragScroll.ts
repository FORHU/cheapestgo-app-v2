'use client';

import { useCallback, useEffect, useRef } from 'react';

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
    velocity: 0,
  });
  const moveRaf = useRef<number | null>(null);
  const glideRaf = useRef<number | null>(null);

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

  const settle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
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
        setSnap('');
      }
    };
    glideRaf.current = requestAnimationFrame(tick);
  }, [setSnap]);

  const runMomentum = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    let velocity = drag.current.velocity;
    const friction = 0.94;
    const step = () => {
      velocity *= friction;
      if (Math.abs(velocity) < 0.05) { settle(); return; }
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + velocity * 16;
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
    if (e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelGlide();
    const d = drag.current;
    d.down = true; d.moved = false;
    d.startX = e.clientX; d.startScroll = el.scrollLeft; d.target = el.scrollLeft;
    d.lastX = e.clientX; d.lastT = e.timeStamp || performance.now(); d.velocity = 0;
  }, [cancelGlide]);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d.down) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setSnap('none');
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    const now = e.timeStamp || performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const instV = (e.clientX - d.lastX) / dt;
      d.velocity = d.velocity * 0.3 + (-instV) * 0.7;
      d.lastX = e.clientX; d.lastT = now;
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
    if (moveRaf.current != null) {
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = null;
      if (el) el.scrollLeft = d.target;
    }
    if (!d.moved) { setSnap(''); return; }
    if (Math.abs(d.velocity) > 0.05) runMomentum();
    else settle();
  }, [runMomentum, settle, setSnap]);

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
