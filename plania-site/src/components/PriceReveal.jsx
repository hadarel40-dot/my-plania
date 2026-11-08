import { Link } from 'react-router-dom';
import { waLink } from '@/lib/products';

export default function PriceReveal({ product }) {
  const p = product.price;
  const block = product.priceBlockColor;
  const href = p.buttonExternal ? p.buttonHref : waLink(p.buttonWa);

  return (
    <div className="px-6 py-12 lg:py-20 text-center text-white" style={{ background: block }}>
      {p.value ? (
        <>
          <p className="text-sm opacity-90 mb-2">{p.lead}</p>
          <div className="font-heading leading-none flex items-baseline justify-center gap-1">
            <span className="text-[4rem] lg:text-[6rem]">{p.value}</span>
            <span style={{ fontSize: '1.75rem' }}>₪</span>
          </div>
          <div className="mt-3 text-sm opacity-90">
            {p.under}
            {p.strike && <s className="opacity-70 mr-1">{p.strike}</s>}
          </div>
        </>
      ) : (
        <h2 className="font-heading text-3xl lg:text-5xl leading-snug max-w-[320px] lg:max-w-[640px] mx-auto" style={{ textWrap: 'balance' }}>
          {p.lead}
        </h2>
      )}
      {p.note && <p className="mt-2 text-xs opacity-80 max-w-[320px] mx-auto">{p.note}</p>}
      {p.note2 && <p className="mt-2 text-xs opacity-80 max-w-[320px] mx-auto">{p.note2}</p>}

      {p.priceList && (
        <div className="mt-6 mx-auto max-w-[300px] text-sm lg:mt-10 lg:max-w-[920px] lg:grid lg:grid-cols-4 lg:gap-4">
          {p.priceList.map((row, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-2.5 border-b border-white/30 last:border-b-0 lg:flex-col lg:justify-center lg:gap-3 lg:py-8 lg:px-4 lg:border lg:last:border-b lg:transition-transform lg:duration-300 lg:hover:-translate-y-1 ${
                i === 1 ? 'lg:bg-white/15 lg:border-white/60' : 'lg:border-white/25'
              }`}
            >
              <span className="lg:text-base">{row.name}</span>
              <span className="font-heading lg:text-3xl">{row.price}</span>
            </div>
          ))}
        </div>
      )}

      {p.afterList && (
        <p className="mt-4 text-xs opacity-80 max-w-[320px] mx-auto">{p.afterList}</p>
      )}

      {p.buttonTo ? (
        <Link
          to={p.buttonTo}
          className="inline-block mt-7 px-6 py-3 rounded-xl font-bold text-sm bg-white"
          style={{ color: block }}
        >
          {p.button}
        </Link>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-7 px-6 py-3 rounded-xl font-bold text-sm bg-white"
          style={{ color: block }}
        >
          {p.button}
        </a>
      )}
    </div>
  );
}