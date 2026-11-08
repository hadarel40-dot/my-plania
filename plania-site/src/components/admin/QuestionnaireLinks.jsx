import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

const LINKS = [
  { label: 'שאלון תכנון טיול', url: 'https://hadarelifergan.com/q/travel' },
  { label: 'שאלון אפיון לעסק', url: 'https://hadarelifergan.com/q/business' },
];

function LinkCard({ label, url }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(`היי! הנה השאלון, ממש בכמה דקות 🙂 ${url}`)}`;

  return (
    <div className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-4">
      <p className="font-heading text-lg text-[#2a2622]">{label}</p>
      <p className="text-xs text-[#6a6158] break-all mt-1" dir="ltr">
        {url}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button size="sm" variant="outline" className="text-xs" onClick={copyLink}>
          {copied ? 'הועתק ✓' : 'העתקת קישור'}
        </Button>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#5E1D1D] text-[#5E1D1D] text-xs transition-colors hover:bg-[#5E1D1D] hover:text-white"
        >
          <WhatsAppIcon className="w-3.5 h-3.5" />
          שליחה בוואטסאפ
        </a>
      </div>
    </div>
  );
}

export default function QuestionnaireLinks() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 bg-[#faf6f1] border border-[#e3d9cc] px-4 py-3"
        >
          <span className="font-heading text-lg text-[#2a2622]">קישורים לשאלונים</span>
          <ChevronDown
            className={`w-4 h-4 text-[#6a6158] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="grid gap-4 md:grid-cols-2">
          {LINKS.map((link) => (
            <LinkCard key={link.url} label={link.label} url={link.url} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}