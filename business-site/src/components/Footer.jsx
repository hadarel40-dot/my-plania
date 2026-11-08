import { Instagram, Mail } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import Logo from './Logo';
import { site, waLink } from '../content';

export default function Footer() {
  const btn = 'inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 font-bold text-sm transition-colors hover:text-white';
  const hover = (e, on) => { e.currentTarget.style.background = on ? site.brand : 'transparent'; };
  const links = [
    site.instagram && { href: site.instagram, label: 'אינסטגרם', icon: <Instagram className="w-4 h-4" /> },
    { href: waLink(site.whatsappHello), label: 'וואטסאפ', icon: <WhatsAppIcon className="w-4 h-4" /> },
    site.email && { href: `mailto:${site.email}`, label: 'מייל', icon: <Mail className="w-4 h-4" /> },
  ].filter(Boolean);

  return (
    <footer className="pt-10 pb-28 lg:pb-12 snap-end border-t-[6px]" style={{ borderTopColor: site.brand, color: site.brand }}>
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] px-5 flex flex-col items-center gap-5">
        <Logo className="h-10 w-auto" textClass="text-3xl" />
        <div className="flex flex-wrap items-center justify-center gap-3">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={btn}
              style={{ borderColor: site.brand }}
              onMouseEnter={(e) => hover(e, true)}
              onMouseLeave={(e) => hover(e, false)}
            >
              {l.icon}
              {l.label}
            </a>
          ))}
        </div>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} {site.name}</p>
      </div>
    </footer>
  );
}
