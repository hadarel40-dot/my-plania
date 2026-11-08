import { site } from '../content';

export default function Logo({ className = '', textClass = 'text-2xl' }) {
  if (site.logo) return <img src={site.logo} alt={site.name} className={className} />;
  return (
    <span className={`font-heading tracking-wide ${textClass}`} style={{ color: site.brand }}>
      {site.name}
    </span>
  );
}
