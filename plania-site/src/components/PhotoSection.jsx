import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Image } from '@/components/ui/image';

// Full-width photo background (slow parallax) with content laid on top.
export default function PhotoSection({ src, tone = '#3a1414', className = '', position = 'center', style, vignette = false, children }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-7%', '7%']);

  return (
    <section ref={ref} className={`relative overflow-hidden isolate ${className}`} style={style}>
      <motion.div className="absolute -inset-x-0 -inset-y-[9%] -z-10" style={reduce ? undefined : { y }}>
        <Image
          src={src}
          alt=""
          fittingType="fill"
          className="block w-full h-full object-cover"
          style={{ objectPosition: position, filter: 'sepia(0.22) saturate(0.85) contrast(0.96) brightness(0.98)' }}
        />
      </motion.div>
      {/* warm brand tint, darker toward the bottom so the card always reads */}
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
