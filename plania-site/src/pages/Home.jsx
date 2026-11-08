import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ServiceBanner from '@/components/ServiceBanner';
import { Image } from '@/components/ui/image';
import { products } from '@/lib/products';
import { LOGO_URL } from '@/lib/brand';

export default function Home() {
  useEffect(() => {
    const el = document.documentElement;
    el.style.scrollSnapType = 'y mandatory';
    return () => { el.style.scrollSnapType = ''; };
  }, []);

  return (
    <div className="relative">
      {/* Soft depth behind the first screen: warm light, a faint burgundy glow at the bottom and fine paper grain */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[100svh] pointer-events-none"
        style={{
          background:
            'radial-gradient(75% 55% at 50% 36%, rgba(255,251,246,0.9) 0%, rgba(255,251,246,0) 72%), radial-gradient(95% 55% at 50% 112%, rgba(94,29,29,0.10) 0%, rgba(94,29,29,0) 70%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[100svh] pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        className="relative z-10 mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] px-5 min-h-[100svh] snap-start flex flex-col justify-center"
        style={{ perspective: 1200 }}
      >
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image src={LOGO_URL} alt="PLANIA'S" className="w-44 h-11 lg:w-64 lg:h-16 mx-auto" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-[#5E1D1D] text-2xl md:text-3xl lg:text-5xl leading-snug mx-auto mt-5 lg:mt-8 max-w-[320px] md:max-w-[520px] lg:max-w-[720px]"
            style={{ textWrap: 'balance' }}
          >
            רעיונות שהופכים למערכות שעובדות.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="text-[#6a6158] text-base lg:text-xl mt-2"
          >
            בבית, בעסק ובטיול.
          </motion.p>
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mx-auto mt-6 h-px w-14 bg-[#5E1D1D]/35"
          />
        </div>
        <div aria-hidden className="absolute bottom-20 lg:bottom-8 inset-x-0 flex flex-col items-center text-[#5E1D1D] pointer-events-none">
          <ChevronDown className="w-6 h-6 motion-safe:animate-bounce" strokeWidth={1.5} />
        </div>
      </div>

      {products.map((p, i) => (
        <ServiceBanner key={p.key} product={p} index={i} />
      ))}
    </div>
  );
}