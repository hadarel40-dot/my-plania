import PhotoSection from './PhotoSection';
import ServiceBanner from './ServiceBanner';
import Reveal from './Reveal';
import { services, site, waLink } from '../content';

const TITLE_SIZES = {
  sm: 'text-xl md:text-2xl lg:text-3xl opacity-80',
  md: 'text-4xl md:text-5xl lg:text-6xl',
  lg: 'text-5xl md:text-6xl lg:text-7xl',
  xl: 'text-6xl md:text-7xl lg:text-8xl',
};

// Title built from lines of different sizes, with struck-through and highlighted words
function StyledTitle({ lines, label, color }) {
  const mark = {
    backgroundImage: `linear-gradient(transparent 60%, ${site.accent}8c 60%, ${site.accent}8c 94%, transparent 94%)`,
  };
  return (
    <h1 className="font-heading leading-[1.05]" style={{ color }} aria-label={label}>
      {lines.map((line, i) => (
        <span key={i} aria-hidden="true" className={`block ${TITLE_SIZES[line.size] || TITLE_SIZES.md} ${i ? 'mt-1 lg:mt-2' : ''}`}>
          {line.parts.map((p, j) => (
            <span
              key={j}
              className={p.strike ? 'line-through decoration-[3px]' : p.mark ? 'px-1' : ''}
              style={p.strike ? { textDecorationColor: site.accent } : p.mark ? mark : undefined}
            >
              {p.t}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

function Section({ title, color, children, className = '' }) {
  return (
    <Reveal className={className}>
      <section className="px-6 py-7 lg:px-0 lg:py-0">
        <h2 className="font-heading text-xl lg:text-2xl mb-4" style={{ color }}>{title}</h2>
        {children}
      </section>
    </Reveal>
  );
}

function Divider({ className = '' }) {
  return <div className={`mx-6 border-t border-dashed border-[#c9beb1] ${className}`} />;
}

function Bullets({ items, color }) {
  return (
    <ul className="space-y-2.5 lg:space-y-3">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-3 items-start leading-relaxed lg:bg-white lg:border lg:border-[#e3d9cc] lg:border-r-4 lg:px-5 lg:py-4 lg:transition-all lg:duration-300 lg:hover:-translate-y-0.5 lg:hover:shadow-[0_10px_30px_rgba(94,29,29,0.08)]"
          style={{ borderRightColor: color }}
        >
          <span className="mt-2.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items, color }) {
  return (
    <ol className="space-y-4 lg:grid lg:gap-4 lg:space-y-0" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 items-start leading-relaxed lg:flex-col">
          <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: color }}>
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function PriceBlock({ service: s }) {
  const p = s.price;
  return (
    <div className="snap-start min-h-[100svh] flex flex-col justify-center px-6 py-12 lg:py-20 text-center text-white" style={{ background: s.color }}>
      <Reveal>
        <p className="text-sm opacity-90 mb-2">{p.lead}</p>
        {p.value && (
          <div className="font-heading leading-none flex items-baseline justify-center gap-1">
            <span className="text-[4rem] lg:text-[6rem]">{p.value}</span>
            <span className="text-[1.75rem]">₪</span>
          </div>
        )}
        {p.under && <p className="mt-3 text-sm opacity-90">{p.under}</p>}
        <a
          href={waLink(p.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-7 px-6 py-3 rounded-xl font-bold text-sm bg-white transition hover:-translate-y-0.5"
          style={{ color: s.color }}
        >
          {p.button}
        </a>
      </Reveal>
    </div>
  );
}

export default function ServicePage({ service: s }) {
  const others = services.filter((o) => o.key !== s.key);
  return (
    <>
      <PhotoSection src={s.image} tone={s.color} className="min-h-[100svh] snap-start flex items-center">
        <div className="relative z-10 mx-auto w-full max-w-[460px] md:max-w-[640px] lg:max-w-[1120px] px-4 sm:px-5 pt-24 pb-24 lg:pb-32">
          <div
            className="bg-[#faf6f1] border-t-[8px] px-6 py-8 lg:px-10 lg:py-10 text-center lg:text-right w-full lg:max-w-[560px] shadow-[0_28px_56px_-20px_rgba(30,10,10,0.75)]"
            style={{ borderTopColor: s.color }}
          >
            {s.hero.eyebrow && (
              <p className="inline-flex items-center gap-2 text-xs lg:text-sm font-bold tracking-wide px-3 py-1.5 rounded-full mb-4" style={{ color: s.color, background: `${s.color}22` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                {s.hero.eyebrow}
              </p>
            )}
            {s.hero.titleLines ? (
              <StyledTitle lines={s.hero.titleLines} label={s.hero.title} color={s.color} />
            ) : (
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl leading-tight" style={{ color: s.color }}>{s.hero.title}</h1>
            )}
            <p className="font-heading text-lg lg:text-2xl mt-2 lg:mt-4" style={{ color: s.color }}>{s.hero.subtitle}</p>
            <p className="leading-relaxed mt-4 lg:mt-6 lg:text-lg">{s.hero.text}</p>
            <a
              href={waLink(s.price.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center mt-6 px-8 py-3.5 rounded-xl font-bold text-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.5)] transition hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: s.color }}
            >
              אני רוצה להתחיל
            </a>
          </div>
        </div>
      </PhotoSection>

      <div className="relative z-20 -mt-10 lg:-mt-20 mx-auto w-full max-w-[460px] md:max-w-[640px] lg:max-w-[1120px] px-3 sm:px-5 pb-12 lg:pb-20">
        <div className="bg-[#faf6f1] border-t-[8px] shadow-[0_24px_48px_-24px_rgba(30,10,10,0.5)]" style={{ borderTopColor: s.color }}>
          <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:px-14 lg:py-14">
            <Section title="זה בשבילכם אם" color={s.color}><Bullets items={s.forYou} color={s.color} /></Section>
            <Divider className="lg:hidden" />
            <Section title="מה מקבלים" color={s.color}><Bullets items={s.youGet} color={s.color} /></Section>
          </div>
          <Divider />
          <div className="lg:px-14 lg:py-14">
            <Section title="איך זה עובד" color={s.color}><Steps items={s.steps} color={s.color} /></Section>
          </div>
        </div>
      </div>

      <PriceBlock service={s} />
      {others.map((o, i) => <ServiceBanner key={o.key} service={o} index={i} />)}
    </>
  );
}
