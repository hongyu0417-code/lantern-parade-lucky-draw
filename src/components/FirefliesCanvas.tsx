import { useEffect, useRef, useState } from 'react';

type FirefliesCanvasProps = {
  intensity: number;
  paused: boolean;
};

type Firefly = { x: number; y: number; radius: number; phase: number; speed: number };
const MAX_PARTICLES = 18;

export function FirefliesCanvas({ intensity, paused }: FirefliesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    const onVisibilityChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const particleCount = Math.min(MAX_PARTICLES, Math.max(0, Math.round(intensity * MAX_PARTICLES)));
    let width = 0;
    let height = 0;
    let frame = 0;
    const particles: Firefly[] = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.7 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.6,
    }));

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        const glow = 0.25 + 0.28 * Math.sin(time * 0.001 * particle.speed + particle.phase);
        const x = particle.x * width + Math.sin(time * 0.0003 + particle.phase) * 7;
        const y = particle.y * height + Math.cos(time * 0.0002 + particle.phase) * 5;
        context.beginPath();
        context.fillStyle = `rgba(255, 209, 123, ${glow})`;
        context.shadowBlur = 3;
        context.shadowColor = 'rgba(255, 177, 75, 0.65)';
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    if (!paused && !hidden && !systemReducedMotion && particleCount > 0) frame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      context.clearRect(0, 0, width, height);
    };
  }, [hidden, intensity, paused, systemReducedMotion]);

  return <canvas ref={canvasRef} className="fireflies-canvas" aria-hidden="true" />;
}
