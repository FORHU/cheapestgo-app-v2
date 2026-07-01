'use client';

import { useEffect, useRef } from 'react';

interface Sparkle {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  rotation: number;
}

function drawStar(ctx: CanvasRenderingContext2D, r: number, rotation: number) {
  const spikes = 4;
  const innerRadius = r * 0.35;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : innerRadius;
    const angle = (i * Math.PI) / spikes + rotation;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function GlobalSparkle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const getDarkMode = () => document.documentElement.classList.contains('dark');

    const sparkles: Sparkle[] = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 4 + 3,
      phase: Math.random(),
      speed: 0.003 + Math.random() * 0.004,
      rotation: Math.random() * Math.PI,
    }));

    let animId: number;
    let lastTime = 0;
    const FRAME_INTERVAL = 1000 / 30;

    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = getDarkMode();

      for (const s of sparkles) {
        if (!prefersReducedMotion) s.phase = (s.phase + s.speed) % 1;
        const alpha = Math.sin(s.phase * Math.PI);
        const scale = alpha * 1.5;
        const r = s.size * scale;
        if (r < 0.5) continue;
        ctx.save();
        ctx.translate(s.x, s.y);
        drawStar(ctx, r, s.rotation);
        ctx.fillStyle = isDark
          ? `rgba(255, 255, 255, ${alpha * 0.7})`
          : `rgba(96, 165, 250, ${alpha * 0.6})`;
        ctx.fill();
        ctx.restore();
      }
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
