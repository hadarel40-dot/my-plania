import { Link } from 'react-router-dom';

export default function ServiceCard({ service: s }) {
  return (
    <Link to={s.path} className="block relative group">
      <div
        className="absolute bottom-full right-0 z-10 rounded-t-lg font-heading px-5 py-1.5 text-sm text-white"
        style={{ background: s.color, letterSpacing: '0.05em' }}
      >
        {s.label}
      </div>
      <div
        className="relative bg-[#faf6f1] border-r-[6px] p-5 pr-7 transition-transform duration-300 group-hover:-translate-y-0.5 shadow-[0_24px_48px_-18px_rgba(30,10,10,0.7)]"
        style={{ borderRightColor: s.color }}
      >
        <span aria-hidden className="absolute inset-[7px] border pointer-events-none" style={{ borderColor: `${s.color}26` }} />
        <h3 className="font-heading text-2xl leading-tight" style={{ color: s.color }}>{s.card.title}</h3>
        <p className="font-heading text-sm mt-1" style={{ color: s.color }}>{s.card.subtitle}</p>
        <p className="text-sm leading-relaxed mt-2">{s.card.text}</p>
        <span className="inline-block mt-4 px-4 py-2 rounded-xl font-bold text-xs text-white" style={{ background: s.color }}>
          {s.card.button}
        </span>
      </div>
    </Link>
  );
}
