import WhatsAppIcon from './WhatsAppIcon';
import { site, waLink } from '../content';

export default function FloatingWhatsApp() {
  return (
    <a
      href={waLink(site.whatsappHello)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="שליחת הודעה בוואטסאפ"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))', left: 'max(1rem, env(safe-area-inset-left))' }}
      className="fixed z-40 w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-[0_12px_30px_-8px_rgba(0,0,0,0.45)] transition hover:scale-105"
    >
      <WhatsAppIcon className="w-7 h-7" />
    </a>
  );
}
