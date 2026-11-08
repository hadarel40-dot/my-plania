import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ProductCard from './ProductCard';
import PhotoSection from './PhotoSection';

// One full-width photo banner with the service card on top. Banners sit flush, each topped by its brand colour.
export default function ServiceBanner({ product, index = 0, className = '' }) {
  const left = index % 2 === 0;
  return (
    <PhotoSection
      src={product.home.image}
      tone={product.titleColor}
      vignette
      className={`border-t-[6px] flex items-center min-h-[100svh] snap-start snap-always ${className}`}
      style={{ borderTopColor: product.color }}
    >
      <div
        className={`relative z-10 mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] px-5 pt-16 pb-28 lg:py-14 flex ${
          left ? 'md:justify-start' : 'md:justify-end'
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:max-w-[380px] lg:max-w-[420px] mr-3"
        >
          <ProductCard product={product} overlay />
        </motion.div>
      </div>
      <div aria-hidden className="absolute bottom-20 lg:bottom-8 inset-x-0 z-10 flex flex-col items-center text-[#f6efe6] pointer-events-none">
        <ChevronDown className="w-6 h-6 motion-safe:animate-bounce" strokeWidth={1.5} />
      </div>
    </PhotoSection>
  );
}
