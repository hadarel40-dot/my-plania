import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Eye, Loader2, Send } from 'lucide-react';
import QuotePreview from './QuotePreview';
import QuotePdfSheet from './QuotePdfSheet';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { formatDateTime } from '@/lib/formatDate';
import { waChatLink } from '@/lib/phone';
import { downloadQuotePdf } from '@/lib/quotePdf';

const SITE_URL = 'https://hadarelifergan.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const shekel = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? `₪${num.toLocaleString('he-IL')}` : 'לא צוין';
};

export default function QuoteViewDialog({ record, type }) {
  const quoteUrl = record.quote_token
    ? `${SITE_URL}/quote/${type}/${record.id}?t=${record.quote_token}`
    : '';
  const approved = Boolean(record.quote_approved_at);

  const sheetRef = useRef(null);
  const [email, setEmail] = useState(record.email || '');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const waMessage = `היי ${record.name || ''}, שולחת שוב את הצעת המחיר. אפשר לצפות ולאשר כאן: ${quoteUrl}`;
  const waHref = quoteUrl ? waChatLink(record.phone, waMessage) : null;

  const resend = async () => {
    setError('');
    setMessage('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('נא להקליד כתובת מייל תקינה');
      return;
    }
    setSending(true);
    try {
      const response = await base44.functions.invoke('resendQuote', {
        type,
        recordId: record.id,
        email: email.trim(),
      });
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }
      setMessage(`ההצעה נשלחה שוב אל ${email.trim()}. נשלח עותק גם אליך.`);
      setConfirming(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'השליחה נכשלה, נסי שוב');
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = async () => {
    setError('');
    setPdfBusy(true);
    try {
      const safeName = String(record.name || 'לקוח').replace(/[\\/:*?"<>|]/g, '').trim();
      await downloadQuotePdf(sheetRef.current, `הצעת מחיר - ${safeName}.pdf`);
    } catch {
      setError('יצירת ה-PDF נכשלה, נסי שוב');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs border-[#5E1D1D] text-[#5E1D1D]">
          <Eye className="w-3.5 h-3.5 ml-1" />
          צפייה בהצעה
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-[#2a2622]">
            הצעת מחיר · {record.name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-[#6a6158] -mt-1 leading-relaxed">
          נשלחה {formatDateTime(record.quote_sent_at)}
          {approved
            ? ` · אושרה ${formatDateTime(record.quote_approved_at)} על ידי ${record.quote_approved_name}`
            : ' · טרם אושרה'}
        </p>

        <div className="mt-3">
          <QuotePreview
            name={record.name}
            price={shekel(record.quote_price)}
            deposit={shekel(record.quote_deposit)}
            delivery={record.quote_delivery || 'לא צוין'}
            brief={record.quote_brief}
          />
        </div>

        <div className="mt-4 border border-[#e3d9cc] bg-[#faf6f1] p-3 space-y-3">
          <p className="font-heading text-base text-[#2a2622]">שליחה חוזרת ללקוח</p>
          <p className="text-xs text-[#6a6158]">
            אותה הצעה ואותו קישור, כך שגם המייל הראשון ממשיך לעבוד
            {approved ? ', וגם האישור שכבר ניתן נשמר' : ''}.
          </p>

          <div>
            <span className="block text-[11px] text-[#6a6158] mb-1">מייל הלקוח</span>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setConfirming(false);
              }}
              className="w-full h-9 px-3 text-sm text-left bg-white border border-[#d9cfc2] text-[#2a2622] focus:outline-none focus:border-[#5E1D1D]"
            />
          </div>

          {!confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="text-xs bg-[#5E1D1D] hover:bg-[#4a1717] text-white"
                disabled={!EMAIL_RE.test(email.trim())}
                onClick={() => {
                  setMessage('');
                  setError('');
                  setConfirming(true);
                }}
              >
                <Send className="w-3.5 h-3.5 ml-1" />
                שליחה חוזרת במייל
              </Button>
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#5E1D1D] text-[#5E1D1D] text-xs transition-colors hover:bg-[#5E1D1D] hover:text-white"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  שליחה בוואטסאפ
                </a>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#d9cfc2] px-3 py-3">
              <p className="text-sm text-[#2a2622]">
                לשלוח את הצעת המחיר שוב אל <span dir="ltr">{email.trim()}</span>?
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" className="text-xs bg-[#5E1D1D] hover:bg-[#4a1717] text-white" onClick={resend} disabled={sending}>
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <Send className="w-3.5 h-3.5 ml-1" />}
                  {sending ? 'שולחים...' : 'כן, לשלוח'}
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setConfirming(false)} disabled={sending}>
                  ביטול
                </Button>
              </div>
            </div>
          )}

          {message && <p className="text-xs text-[#4A6355]">{message}</p>}
          {error && <p className="text-xs text-[#a33]">{error}</p>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={downloadPdf} disabled={pdfBusy}>
            {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <Download className="w-3.5 h-3.5 ml-1" />}
            {pdfBusy ? 'יוצרים PDF...' : 'הורדה כ-PDF'}
          </Button>
          {quoteUrl && (
            <a href={quoteUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="text-xs">
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                פתיחת העמוד שהלקוח רואה
              </Button>
            </a>
          )}
          {record.quote_payment_url && (
            <a href={record.quote_payment_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="text-xs">
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                קישור לתשלום מקדמה
              </Button>
            </a>
          )}
        </div>

        {/* Off-screen copy used only to produce the PDF */}
        <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
          <QuotePdfSheet
            ref={sheetRef}
            record={record}
            quoteUrl={quoteUrl}
            price={shekel(record.quote_price)}
            deposit={shekel(record.quote_deposit)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
