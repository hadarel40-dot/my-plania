import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { waChatLink } from '@/lib/phone';

export default function PhoneActions({ phone, name }) {
  const href = waChatLink(phone, name ? `היי ${name}, כאן הדראל` : '');

  if (!href) {
    return <span className="text-sm text-[#6a6158]">{phone || '—'}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#2a2622]" dir="ltr">
        {phone}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 border border-[#5E1D1D] text-[#5E1D1D] text-xs transition-colors hover:bg-[#5E1D1D] hover:text-white"
      >
        <WhatsAppIcon className="w-3.5 h-3.5" />
        וואטסאפ
      </a>
    </div>
  );
}