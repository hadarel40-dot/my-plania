import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';

// Phones in depth: the active one in the middle, its neighbours angled behind it.
// Click a side phone, use the arrows or dots, or swipe to move between them.
export default function PhoneCarousel({
  items,
  renderPhone,
  width = 210,
  step = 118,
  autoplayMs = 0,
  onFrontClick,
  caption,
}) {
  const [index, setIndex] = useState(0);
  const total = items.length;
  const half = Math.floor(total / 2);
  const ref = useRef(null);
  const height = Math.round(width * 2.05) + 24;

  useEffect(() => {
    if (!autoplayMs || total < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % total), autoplayMs);
    return () => clearInterval(timer);
  }, [autoplayMs, total, index]);

  // Stop any video that is no longer in front
  useEffect(() => {
    ref.current?.querySelectorAll('video').forEach((v) => v.pause());
  }, [index]);

  const go = (dir) => setIndex((i) => (i + dir + total) % total);

  const onDragEnd = (_, info) => {
    if (info.offset.x < -50) go(1);
    else if (info.offset.x > 50) go(-1);
  };

  return (
    <div ref={ref} className="pt-6 pb-5 px-2">
      <div className="relative flex items-center justify-center" style={{ height: height + 20 }}>
        {total > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="הקודם"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-2 text-[#f0e8df]"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}

        <motion.div
          className="relative w-full"
          style={{ height, perspective: 1200 }}
          drag={total > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={onDragEnd}
        >
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 bottom-0 h-7 rounded-full bg-black/50 blur-2xl"
            style={{ width: width * 0.8 }}
          />
          {items.map((src, i) => {
            const d = ((i - index + total + half) % total) - half;
            const abs = Math.abs(d);
            const isFront = d === 0;
            const visible = abs <= 1;
            const clickable = !isFront || onFrontClick;

            return (
              <motion.div
                key={src}
                className="absolute top-0"
                style={{
                  left: '50%',
                  marginLeft: -width / 2,
                  width,
                  zIndex: 10 - abs,
                  transformStyle: 'preserve-3d',
                  pointerEvents: visible ? 'auto' : 'none',
                }}
                initial={false}
                animate={{
                  x: d * step,
                  scale: isFront ? 1 : 0.8,
                  rotateY: -d * 30,
                  opacity: visible ? (isFront ? 1 : 0.55) : 0,
                  y: isFront ? 0 : 18,
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderPhone(src, isFront, i)}
                {visible && clickable && (
                  <button
                    type="button"
                    onClick={() => (isFront ? onFrontClick(i) : setIndex(i))}
                    aria-label={isFront ? `פתיחת מסך ${i + 1}` : `מעבר למסך ${i + 1}`}
                    className="absolute inset-0 z-10"
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {total > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="הבא"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-2 text-[#f0e8df]"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {items.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`מסך ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-[#f0e8df]' : 'w-1.5 bg-[#f0e8df]/35'
              }`}
            />
          ))}
        </div>
      )}

      {autoplayMs > 0 && (
        <div className="mt-3 mx-4 h-[2px] bg-[#f0e8df]/20 overflow-hidden">
          <motion.div
            key={index}
            className="h-full bg-[#f0e8df]"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: autoplayMs / 1000, ease: 'linear' }}
          />
        </div>
      )}

      {caption && (
        <p className="text-center text-xs text-[#f0e8df]/75 mt-3">{caption(index, total)}</p>
      )}
    </div>
  );
}
