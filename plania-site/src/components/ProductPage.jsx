import BulletList from './BulletList';
import StepList from './StepList';
import PriceReveal from './PriceReveal';
import TravelWorkSample from './travel/WorkSample';
import BusinessWorkSample from './business/WorkSample';
import PlaniaWorkSample from './plania/WorkSample';
import StartQuestionnaire from './StartQuestionnaire';
import Reveal from './Reveal';
import PhotoSection from './PhotoSection';
import ServiceBanner from './ServiceBanner';
import { products } from '@/lib/products';

const WORK_SAMPLES = {
  travel: TravelWorkSample,
  business: BusinessWorkSample,
  plania: PlaniaWorkSample,
};

function Section({ title, color, children, className = '' }) {
  return (
    <Reveal className={className}>
      <section className="px-6 py-7 lg:px-0 lg:py-0">
        <h2 className="font-heading text-xl lg:text-2xl mb-4" style={{ color }}>
          {title}
        </h2>
        {children}
      </section>
    </Reveal>
  );
}

const TITLE_SIZES = {
  sm: 'text-xl md:text-2xl lg:text-3xl opacity-80',
  md: 'text-4xl md:text-5xl lg:text-6xl',
  lg: 'text-5xl md:text-6xl lg:text-7xl',
  xl: 'text-6xl md:text-7xl lg:text-8xl',
};

const MARK_STYLE = {
  backgroundImage:
    'linear-gradient(transparent 60%, rgba(181,132,142,0.55) 60%, rgba(181,132,142,0.55) 94%, transparent 94%)',
};

// A title built from lines with their own size, plus struck-through and highlighted words
function StyledTitle({ lines, label, color }) {
  return (
    <h1 className="font-heading leading-[1.05]" style={{ color }} aria-label={label}>
      {lines.map((line, i) => (
        <span key={i} aria-hidden="true" className={`block ${TITLE_SIZES[line.size] || TITLE_SIZES.md} ${i > 0 ? 'mt-1 lg:mt-2' : ''}`}>
          {line.parts.map((part, j) => (
            <span
              key={j}
              className={part.strike ? 'line-through decoration-[#B5848E] decoration-[3px]' : part.mark ? 'px-1' : ''}
              style={part.mark ? MARK_STYLE : undefined}
            >
              {part.t}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

function Divider({ className = '' }) {
  return <div className={`mx-6 border-t border-dashed border-[#c9beb1] ${className}`} />;
}

export default function ProductPage({ product }) {
  const others = products.filter((p) => p.key !== product.key);
  const WorkSample = WORK_SAMPLES[product.key];
  const hasQuestionnaire = product.key === 'travel' || product.key === 'business';
  const sampleTitle = product.key === 'plania' ? 'הצצה לאפליקציה' : 'דוגמה מהעבודה שלי';

  return (
    <>
      <PhotoSection
        src={product.home.image}
        tone={product.titleColor}
        className="min-h-[100svh] snap-start flex items-center"
      >
        <div className="relative z-10 mx-auto w-full max-w-[460px] md:max-w-[640px] lg:max-w-[1120px] px-4 sm:px-5 pt-24 pb-24 lg:pt-24 lg:pb-32">
          <div
            className="bg-[#faf6f1] border-t-[8px] px-6 py-8 lg:px-10 lg:py-10 text-center lg:text-right w-full lg:max-w-[560px] shadow-[0_28px_56px_-20px_rgba(30,10,10,0.75)]"
            style={{ borderTopColor: product.color }}
          >
            {product.hero.eyebrow && (
              <p
                className="inline-flex items-center gap-2 text-xs lg:text-sm font-bold tracking-wide px-3 py-1.5 rounded-full mb-4"
                style={{ color: product.titleColor, background: `${product.color}22` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: product.color }} />
                {product.hero.eyebrow}
              </p>
            )}
            {product.hero.titleLines ? (
              <StyledTitle lines={product.hero.titleLines} label={product.hero.title} color={product.titleColor} />
            ) : (
              <h1 className="font-heading text-3xl md:text-4xl lg:text-6xl leading-tight" style={{ color: product.titleColor }}>
                {product.hero.title}
              </h1>
            )}
            <p className="font-heading text-lg lg:text-2xl mt-2 lg:mt-4" style={{ color: product.titleColor }}>
              {product.hero.subtitle}
            </p>
            <p className="text-[#2a2622] leading-relaxed mt-4 lg:mt-6 lg:text-lg">{product.hero.text}</p>
            {product.hero.note && (
              <p className="text-sm text-[#6a6158] leading-relaxed mt-4 bg-[#f2ece4] rounded-lg px-4 py-3">{product.hero.note}</p>
            )}
            {product.hero.highlight && (
              <p className="font-heading text-xl mt-4" style={{ color: product.color }}>{product.hero.highlight}</p>
            )}
            {hasQuestionnaire && (
              <a
                href="#start"
                className="inline-flex items-center justify-center mt-6 px-8 py-3.5 rounded-xl font-bold text-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.5)] transition hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: product.titleColor }}
              >
                אני רוצה להתחיל
              </a>
            )}
          </div>
        </div>
      </PhotoSection>

    <div className="relative z-20 -mt-10 lg:-mt-20 mx-auto w-full max-w-[460px] md:max-w-[640px] lg:max-w-[1120px] px-3 sm:px-5 pb-12 lg:pb-20">
      <div className="bg-[#faf6f1] border-t-[8px] shadow-[0_24px_48px_-24px_rgba(30,10,10,0.5)]" style={{ borderTopColor: product.color }}>
        {WorkSample && (
          <Reveal className="hidden lg:block">
            <div className="lg:px-14 lg:pt-14">
              <p className="font-heading text-lg mb-3 flex items-center gap-2" style={{ color: product.titleColor }}>
                <span className="w-6 h-[2px]" style={{ background: product.color }} />
                {sampleTitle}
              </p>
              <WorkSample />
            </div>
          </Reveal>
        )}

        <Divider />

        {/* Who it's for + what you get: stacked on mobile, two columns on desktop */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:px-14 lg:py-14">
          <Section title="זה בשבילכם אם" color={product.titleColor}>
            <BulletList items={product.forYou} color={product.color} cards />
          </Section>
          <Divider className="lg:hidden" />
          <Section title="מה מקבלים" color={product.titleColor}>
            <BulletList items={product.youGet} color={product.color} cards />
          </Section>
        </div>

        {product.extra && (
          <>
            <Divider />
            <Section title={product.extra.title} color={product.titleColor} className="lg:px-14 lg:py-10">
              <BulletList items={product.extra.items} color={product.color} />
              <p className="text-[#6a6158] leading-relaxed mt-4 text-sm">{product.extra.paragraph}</p>
            </Section>
          </>
        )}

        <Divider />

        {hasQuestionnaire ? (
          <Reveal>
            <StartQuestionnaire type={product.key} color={product.color} titleColor={product.titleColor} />
          </Reveal>
        ) : (
          <div className="lg:px-14 lg:py-14">
            <Section title="איך זה עובד" color={product.titleColor}>
              <StepList items={product.howItWorks} color={product.color} />
            </Section>
          </div>
        )}

        {/* On mobile the work sample stays near the bottom, as before */}
        {WorkSample && (
          <div className="lg:hidden">
            <Divider />
            <Section title={sampleTitle} color={product.titleColor}>
              <WorkSample />
            </Section>
          </div>
        )}

      </div>

    </div>

    <div className="snap-start min-h-[100svh] flex flex-col justify-center" style={{ background: product.priceBlockColor }}>
      <PriceReveal product={product} />
    </div>

    {others.map((p, i) => (
      <ServiceBanner key={p.key} product={p} index={i} />
    ))}
    </>
  );
}
