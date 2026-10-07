import React, { useEffect, useRef } from 'react';

interface HazeWeatherCanvasProps {
  /** Normalized haze intensity from 0.0 (crystal clear) to 1.0 (severe hazardous haze) */
  intensity: number;
  /** Dominant PSI value for subtle color grading */
  effectivePsi: number;
  /** Optional wind drift speed multiplier */
  windSpeed?: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  phaseSpeed: number;
  layer: number; // 0 = background plume, 1 = mid particulate, 2 = foreground fine speck
}

/**
 * Interactive full-viewport atmospheric haze & dimming weather effect engine.
 * - When air is clean (intensity -> 0), particles smoothly fade out and ambient light is clear.
 * - When hazy or very hazy (intensity > 0.25), the page is enveloped in a dim, warm-amber/smoky
 *   low-visibility shroud with multi-layered floating haze particles drifting across the viewport.
 */
export const HazeWeatherCanvas: React.FC<HazeWeatherCanvasProps> = ({
  intensity,
  effectivePsi,
  windSpeed = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentIntensityRef = useRef<number>(intensity);
  const targetIntensityRef = useRef<number>(intensity);

  useEffect(() => {
    targetIntensityRef.current = Math.max(0, Math.min(1, intensity));
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Create 130 particles across 3 depth layers
    const TOTAL_PARTICLES = 130;
    const particles: Particle[] = Array.from({ length: TOTAL_PARTICLES }, (_, i) => {
      const layer = i < 28 ? 0 : i < 85 ? 1 : 2;
      const radius =
        layer === 0
          ? 65 + Math.random() * 110 // Soft atmospheric haze plumes
          : layer === 1
          ? 2.2 + Math.random() * 4.5 // Mid-sized suspended PM10/PM2.5
          : 0.9 + Math.random() * 2.0; // Sharp foreground fine dust

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        vx: (0.18 + Math.random() * 0.45) * (layer === 0 ? 0.5 : layer === 1 ? 0.85 : 1.2),
        vy: (Math.random() - 0.5) * 0.22 - 0.05,
        baseAlpha:
          layer === 0
            ? 0.035 + Math.random() * 0.045
            : layer === 1
            ? 0.18 + Math.random() * 0.32
            : 0.28 + Math.random() * 0.42,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.008 + Math.random() * 0.018,
        layer,
      };
    });

    const render = () => {
      // Smoothly interpolate currentIntensity toward targetIntensity so particles fade in/out gracefully
      const diff = targetIntensityRef.current - currentIntensityRef.current;
      currentIntensityRef.current += diff * 0.045;

      const activeIntensity = currentIntensityRef.current;

      ctx.clearRect(0, 0, width, height);

      // Only draw particles if intensity is perceptible (> 0.01)
      if (activeIntensity > 0.01) {
        // Determine tint based on severity (amber-ochre for Unhealthy, smoky orange-brown for Very Unhealthy/Hazardous)
        const rTint = effectivePsi > 200 ? 235 : effectivePsi > 100 ? 225 : 185;
        const gTint = effectivePsi > 200 ? 155 : effectivePsi > 100 ? 180 : 205;
        const bTint = effectivePsi > 200 ? 110 : effectivePsi > 100 ? 135 : 215;

        // Ambient turbid atmospheric wash on canvas
        const washAlpha = activeIntensity * 0.24;
        const washGrad = ctx.createLinearGradient(0, 0, 0, height);
        washGrad.addColorStop(0, `rgba(${rTint - 40}, ${gTint - 45}, ${bTint - 45}, ${washAlpha * 1.2})`);
        washGrad.addColorStop(0.5, `rgba(${rTint - 25}, ${gTint - 30}, ${bTint - 35}, ${washAlpha * 0.75})`);
        washGrad.addColorStop(1, `rgba(12, 14, 18, ${washAlpha * 1.35})`);
        ctx.fillStyle = washGrad;
        ctx.fillRect(0, 0, width, height);

        const activeCount = Math.floor(TOTAL_PARTICLES * Math.min(1, activeIntensity * 1.25));

        for (let i = 0; i < activeCount; i++) {
          const p = particles[i];

          if (!prefersReducedMotion) {
            p.phase += p.phaseSpeed;
            p.x += p.vx * windSpeed * (0.7 + activeIntensity * 0.9);
            p.y += p.vy + Math.sin(p.phase) * 0.18;

            if (p.x - p.radius > width) {
              p.x = -p.radius;
              p.y = Math.random() * height;
            }
            if (p.y + p.radius < 0) {
              p.y = height + p.radius;
            } else if (p.y - p.radius > height) {
              p.y = -p.radius;
            }
          }

          const twinkle = 0.75 + 0.25 * Math.sin(p.phase);
          const alpha = p.baseAlpha * activeIntensity * twinkle;

          if (p.layer === 0) {
            // Soft radial haze cloud plume
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            grad.addColorStop(0, `rgba(${rTint}, ${gTint}, ${bTint}, ${alpha})`);
            grad.addColorStop(0.6, `rgba(${rTint}, ${gTint}, ${bTint}, ${alpha * 0.4})`);
            grad.addColorStop(1, `rgba(${rTint}, ${gTint}, ${bTint}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Suspended aerosol / PM2.5 particulate
            ctx.fillStyle = `rgba(${rTint}, ${gTint}, ${bTint}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [effectivePsi, windSpeed]);

  // Calculate dim light shroud opacity when very hazy
  const dimLightOpacity = Math.max(0, Math.min(0.62, (intensity - 0.15) * 0.72));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden transition-opacity duration-1000"
      aria-hidden="true"
    >
      {/* Dim-light atmospheric shroud when conditions are hazy / very hazy */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          opacity: dimLightOpacity,
          background:
            effectivePsi > 150
              ? 'radial-gradient(circle at 50% 30%, rgba(42, 28, 16, 0.55) 0%, rgba(15, 12, 10, 0.85) 100%)'
              : 'radial-gradient(circle at 50% 30%, rgba(36, 30, 22, 0.42) 0%, rgba(10, 12, 16, 0.75) 100%)',
        }}
      />
      {/* Floating haze particulate canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
};
