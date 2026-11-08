import { Link } from 'react-router-dom';
import PhotoFrame from './PhotoFrame';

export default function ProductCard({ product, compact = false, overlay = false }) {
  const pad = compact ? 'p-4 pr-6' : 'p-5 pr-7';
  const titleSize = compact ? 'text-lg' : 'text-2xl';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const tabPadding = compact ? '8px 5px' : '12px 7px';
  const tabFont = compact ? '0.75rem' : '0.875rem';

  return (
    <Link to={product.path} className="block relative group">
      {overlay ? (
        <div
          className="absolute bottom-full right-0 z-10 rounded-t-lg font-heading px-5 py-1.5 text-sm"
          style={{ background: product.tabColor, color: product.tabText, letterSpacing: '0.05em' }}
        >
          {product.tabLabel}
        </div>
      ) : (
      <div
        className="absolute top-1/2 z-10 rounded-l-lg font-heading"
        style={{
          background: product.tabColor,
          color: product.tabText,
          writingMode: 'vertical-rl',
          letterSpacing: '0.05em',
          right: '100%',
          marginRight: '-6px',
          transform: 'translateY(-50%)',
          padding: tabPadding,
          fontSize: tabFont,
        }}
      >
        {product.tabLabel}
      </div>
      )}
      <div
        className={`relative bg-[#faf6f1] border-r-[6px] ${pad} transition-transform duration-300 group-hover:-translate-y-0.5 ${overlay ? 'shadow-[0_24px_48px_-18px_rgba(30,10,10,0.7)]' : ''}`}
        style={{ borderRightColor: product.color }}
      >
        {overlay && (
          <span
            aria-hidden
            className="absolute inset-[7px] border pointer-events-none"
            style={{ borderColor: `${product.color}26` }}
          />
        )}
        {product.home.image && !compact && !overlay && (
          <PhotoFrame
            src={product.home.image}
            tone={product.titleColor}
            className="mb-5"
            imgClassName="h-44 sm:h-52"
          />
        )}
        <h3 className={`font-heading ${titleSize} leading-tight`} style={{ color: product.titleColor }}>
          {product.home.title}
        </h3>
        <p className="font-heading text-sm mt-1" style={{ color: product.titleColor }}>
          {product.home.subtitle}
        </p>
        <p className={`text-[#2a2622] ${textSize} leading-relaxed mt-2`}>
          {product.home.text}
        </p>
        <span
          className="inline-block mt-4 px-4 py-2 rounded-xl font-bold text-xs"
          style={{ background: product.btnColor, color: product.btnText || '#ffffff' }}
        >
          {product.home.button}
        </span>
      </div>
    </Link>
  );
}