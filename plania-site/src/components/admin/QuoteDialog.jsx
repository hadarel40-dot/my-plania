import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Loader2, Pencil, Send } from 'lucide-react';
import QuotePreview from './QuotePreview';
import { formatDateTime } from '@/lib/formatDate';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClass =
  'w-full h-9 px-3 text-sm bg-white border border-[#d9cfc2] text-[#2a2622] focus:outline-none focus:border-[#5E1D1D]';

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-[11px] text-[#6a6158] mb-1">{label}</span>
      {children}
    </div>
  );
}

export default function QuoteDialog({ record, type, onSent }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(record.email || '');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [delivery, setDelivery] = useState('');
  const [brief, setBrief] = useState('');
  const [paymentUrl, setPaymentUrl] = useState(record.quote_payment_url || '');
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [synced, setSynced] = useState(null);

  const hasPrevious = Boolean(record.quote_sent_at);

  // Every time the dialog opens it starts from what is saved on the record, so a new
  // quote begins from the last one and never shows the "sent" screen of a previous send.
  useEffect(() => {
    if (!open) return;
    setEmail(record.email || '');
    setPrice(record.quote_price ? String(record.quote_price) : '');
    setDeposit(record.quote_deposit ? String(record.quote_deposit) : '');
    setDelivery(record.quote_delivery || '');
    setBrief(record.quote_brief || '');
    setPaymentUrl(record.quote_payment_url || '');
    setPreview(false);
    setError('');
    setSentAt('');
    setSynced(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const priceLabel = price ? `₪${Number(price).toLocaleString('he-IL')}` : '₪0';
  const depositLabel = deposit ? `₪${Number(deposit).toLocaleString('he-IL')}` : 'לא צוין';
  const deliveryLabel = delivery.trim() || 'לא צוין';

  const send = async () => {
    setError('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('נא להקליד כתובת מייל תקינה');
      return;
    }
    if (!price || Number(price) <= 0) {
      setError('נא להקליד מחיר');
      return;
    }
    if (!brief.trim()) {
      setError('נא לכתוב בריף');
      return;
    }
    if (paymentUrl.trim() && !paymentUrl.trim().startsWith('https://')) {
      setError('קישור התשלום צריך להתחיל ב-https://');
      return;
    }
    setSending(true);
    try {
      const response = await base44.functions.invoke('sendQuote', {
        type,
        recordId: record.id,
        name: record.name,
        email: email.trim(),
        price: Number(price),
        deposit: deposit ? Number(deposit) : null,
        delivery: delivery.trim(),
        brief: brief.trim(),
        paymentUrl: paymentUrl.trim(),
      });
      if (response.data?.error) {
        setError(response.data.error);
        return;
      }
      onSent(response.data.patch, response.data.synced);
      setSynced(response.data.synced || null);
      setSentAt(response.data.patch.quote_sent_at);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.patch) onSent(data.patch, data.synced);
      setError(data?.error || 'שליחת ההצעה נכשלה, נסו שוב');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs border-[#5E1D1D] text-[#5E1D1D]">
          {hasPrevious ? 'הצעה מעודכנת' : 'שליחת הצעת מחיר'}
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-[#2a2622]">
            הצעת מחיר · {record.name}
          </DialogTitle>
        </DialogHeader>

        {sentAt ? (
          <div className="py-4 text-center">
            <p className="text-sm text-[#2a2622]">הצעת המחיר נשלחה ל-{email}.</p>
            <p className="text-xs text-[#6a6158] mt-1">נשלח עותק גם אליך.</p>
            {(synced?.lead || synced?.project) && (
              <p className="text-xs text-[#4A6355] mt-1">
                עודכנו גם: {[synced.lead && 'הליד (סטטוס, שווי ותאריך מעקב)', synced.project && 'מחיר הפרויקט'].filter(Boolean).join(', ')}
              </p>
            )}
            <Button size="sm" className="mt-4 text-xs" onClick={() => setOpen(false)}>
              סגירה
            </Button>
          </div>
        ) : preview ? (
          <div>
            <QuotePreview
              name={record.name}
              price={priceLabel}
              deposit={depositLabel}
              delivery={deliveryLabel}
              brief={brief}
            />
            <div className="flex items-center gap-2 mt-4">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreview(false)}>
                <Pencil className="w-3.5 h-3.5 ml-1" />
                חזרה לעריכה
              </Button>
              <Button size="sm" className="text-xs" onClick={send} disabled={sending}>
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <Send className="w-3.5 h-3.5 ml-1" />}
                {sending ? 'שולחים...' : 'שליחת המייל'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {hasPrevious && (
              <p className="text-xs text-[#6a6158] bg-[#f3e7e1] px-3 py-2">
                נשלחה הצעה ב-{formatDateTime(record.quote_sent_at)}. השדות מועברים ממנה. שליחה תחליף אותה
                {record.quote_approved_at ? ' ותבטל את האישור שהלקוח כבר נתן' : ''}, ותעדכן את הליד ואת הפרויקט.
              </p>
            )}
            <Field label="מייל הלקוח">
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${inputClass} text-left`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="מחיר (₪)">
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="מקדמה (₪)">
                <input
                  type="number"
                  min="0"
                  value={deposit}
                  onChange={(event) => setDeposit(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="זמן אספקה">
              <input
                type="text"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                placeholder="לדוגמה: שבועיים"
                className={inputClass}
              />
            </Field>

            <Field label="בריף">
              <Textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                rows={6}
                placeholder="מה הבנתי, מה כלול, מה לא כלול"
                className="text-sm bg-white border-[#d9cfc2]"
              />
            </Field>

            <Field label="קישור לתשלום מקדמה (Grow)">
              <input
                type="url"
                dir="ltr"
                value={paymentUrl}
                onChange={(event) => setPaymentUrl(event.target.value)}
                placeholder="https://..."
                className={`${inputClass} text-left`}
              />
            </Field>

            {error && <p className="text-xs text-[#a33]">{error}</p>}

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreview(true)}>
                <Eye className="w-3.5 h-3.5 ml-1" />
                תצוגה מקדימה
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}