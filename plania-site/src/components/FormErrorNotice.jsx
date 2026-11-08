import { waLink } from '@/lib/products';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

export default function FormErrorNotice({ color }) {
  return (
    <div className="bg-[#f2ece4] border border-[#e3d9cc] px-4 py-4 text-center">
      <p className="text-sm text-[#2a2622] leading-relaxed">
        משהו השתבש, אפשר לנסות שוב או לשלוח לי הודעה בוואטסאפ
      </p>
      <a
        href={waLink('היי הדראל, ניסיתי לשלוח טופס באתר וזה לא הצליח')}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-sm font-bold text-white"
        style={{ background: color }}
      >
        <WhatsAppIcon className="w-4 h-4" />
        שליחת הודעה בוואטסאפ
      </a>
    </div>
  );
}