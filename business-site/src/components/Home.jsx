import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ServiceBanner from './ServiceBanner';
import Logo from './Logo';
import { GRAIN } from './PhotoSection';
import { services, site } from '../content';

export default function Home() {
  useEffect(() => {
    const el = document.documentElement;
    el.style.scrollSnapType = 'y mandatory';
    return () => { el.style.scrollSnapType = ''; };
  }, []);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[100svh] pointer-events-none"
        style={{
          background: `radial-gradient(75% 55% at 50% 36%, rgba(255,251,246,0.9) 0%, rgba(255,251,246,0) 72%), radial-gradient(95% 55% at 50% 112%, ${site.brand}1a 0%, transparent 70%)`,
        }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[100svh] pointer-events-none opacity-[0.07]" style={{ backgroundImage: GRAIN }} />
      <div className="relative z-10 mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] px-5 min-h-[100svh] snap-start flex flex-col justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <Logo className="h-12 lg:h-16 w-auto mx-auto" textClass="text-4xl lg:text-6xl" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-2xl md:text-3xl lg:text-5xl leading-snug mx-auto mt-5 lg:mt-8 max-w-[320px] md:max-w-[520px] lg:max-w-[720px]"
            style={{ color: site.brand, textWrap: 'balance' }}
          >
            {site.tagline}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="text-[#6a6158] text-base lg:text-xl mt-2"
          >
            {site.subline}
          </motion.p>
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scaleX: 0.4 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mx-auto mt-6 h-px w-14"
            style={{ background: `${site.brand}59` }}
          />
        </div>
        <div aria-hidden className="absolute bottom-20 lg:bottom-8 inset-x-0 flex justify-center pointer-events-none" style={{ color: site.brand }}>
          <ChevronDown className="w-6 h-6 motion-safe:animate-bounce" strokeWidth={1.5} />
        </div>
      </div>
      {services.map((s, i) => <ServiceBanner key={s.key} service={s} index={i} />)}
    </div>
  );
}
