import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ServiceCard from './ServiceCard';
import PhotoSection from './PhotoSection';

// One full-screen banner per service, the card alternating sides on wide screens
export default function ServiceBanner({ service, index = 0 }) {
  const left = index % 2 === 0;
  return (
    <PhotoSection
      src={service.image}
      tone={service.color}
      vignette
      className="border-t-[6px] flex items-center min-h-[100svh] snap-start snap-always"
      style={{ borderTopColor: service.color }}
    >
      <div className={`relative z-10 mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] px-5 pt-16 pb-28 lg:py-14 flex ${left ? 'md:justify-start' : 'md:justify-end'}`}>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:max-w-[380px] lg:max-w-[420px] mr-3"
        >
          <ServiceCard service={service} />
        </motion.div>
      </div>
      <div aria-hidden className="absolute bottom-20 lg:bottom-8 inset-x-0 z-10 flex justify-center text-[#f6efe6] pointer-events-none">
        <ChevronDown className="w-6 h-6 motion-safe:animate-bounce" strokeWidth={1.5} />
      </div>
    </PhotoSection>
  );
}
