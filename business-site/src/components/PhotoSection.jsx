import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Full-width background with slow parallax. With no photo it draws a soft background in the service colour.
export default function PhotoSection({ src, tone = '#3a1414', className = '', style, vignette = false, children }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-7%', '7%']);

  return (
    <section ref={ref} className={`relative overflow-hidden isolate ${className}`} style={style}>
      <motion.div className="absolute inset-x-0 -inset-y-[9%] -z-10" style={reduce ? undefined : { y }}>
        {src ? (
          <img
            src={src}
            alt=""
            className="block w-full h-full object-cover"
            style={{ filter: 'sepia(0.22) saturate(0.85) contrast(0.96) brightness(0.98)' }}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `radial-gradient(80% 60% at 70% 25%, #f3e7da 0%, transparent 60%), radial-gradient(70% 70% at 15% 85%, ${tone}cc 0%, transparent 70%), linear-gradient(160deg, #d9c6b3 0%, ${tone}88 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 opacity-[0.12] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      </motion.div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: `linear-gradient(180deg, ${tone}22 0%, ${tone}55 60%, ${tone}99 100%)` }}
      />
      {vignette && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{ background: 'radial-gradient(120% 90% at 50% 45%, rgba(30,10,10,0) 55%, rgba(30,10,10,0.30) 100%)' }}
        />
      )}
      {children}
    </section>
  );
}
export { GRAIN };
