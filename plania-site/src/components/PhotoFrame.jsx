import { Image } from '@/components/ui/image';

// Rounded photo frame with a soft warm grade so any photo sits in the site's palette.
export default function PhotoFrame({ src, alt = '', tone = '#5E1D1D', radius = 32, className = '', imgClassName = '' }) {
  return (
    <div
      className={`relative overflow-hidden ring-1 ring-[#e3d9cc] shadow-[0_12px_28px_-14px_rgba(94,29,29,0.35)] ${className}`}
      style={{ borderRadius: radius, isolation: 'isolate' }}
    >
      <Image
        src={src}
        alt={alt}
        fittingType="fill"
        className={`block w-full object-cover ${imgClassName}`}
        style={{ filter: 'sepia(0.28) saturate(0.78) contrast(0.94) brightness(1.03)' }}
      />
      {/* warm cream wash */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: '#efe2d2', mixBlendMode: 'soft-light', opacity: 0.55 }}
      />
      {/* brand-colour tint, deeper at the edges */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(120% 90% at 50% 40%, transparent 55%, ${tone}55 100%)`,
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
