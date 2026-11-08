import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { formatDateTime } from '@/lib/formatDate';
import useNoIndex from '@/hooks/useNoIndex';
import { CheckCircle2, CreditCard } from 'lucide-react';

const LOGO = 'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/69c9d343d_logo.png';
const WHATSAPP_URL = 'https://wa.me/972539306048';

const shekel = (value) => `₪${Number(value).toLocaleString('he-IL')}`;

function Shell({ children }) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#f0e8df] px-4 py-8">
      <div className="mx-auto w-full max-w-[560px] bg-[#faf6f1] border border-[#e5e7eb]">
        <header className="bg-[#5E1D1D] text-white px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-heading text-xl">Plania’s</p>
            <p className="text-[11px] text-[#f0d9d9]">תכנון חכם לבית, לטיולים ולעסקים</p>
          </div>
          <Image src={LOGO} alt="Plania’s" className="w-16 h-16" fittingType="fit" />
        </header>
        {children}
        <footer className="bg-[#5E1D1D] text-white px-6 py-4">
          <p className="text-sm font-bold">הדראל איפרגן</p>
          <p className="text-xs text-[#f0d9d9] mt-1">053-9306048 · planiasmartplan@gmail.com</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-[#f0d9d9] mt-1 underline"
          >
            שאלות? אפשר לכתוב לי בוואטסאפ
          </a>
        </footer>
      </div>
    </div>
  );
}

export default function Quote() {
  useNoIndex();
  const { type, id } = useParams();
  const token = new URLSearchParams(window.location.search).get('t') || '';

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [redirectIn, setRedirectIn] = useState(null);
  const justApproved = useRef(false);

  useEffect(() => {
    if (redirectIn === null || !quote?.payment_url) return undefined;
    if (redirectIn <= 0) {
      window.location.href = quote.payment_url;
      return undefined;
    }
    const timer = setTimeout(() => setRedirectIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [redirectIn, quote?.payment_url]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.functions
      .invoke('getQuote', { type, id, token })
      .then((response) => {
        if (active) setQuote(response.data?.quote || null);
      })
      .catch(() => {
        if (active) setQuote(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type, id, token]);

  const approve = async () => {
    setError('');
    if (!name.trim()) {
      setError('נא להקליד שם מלא');
      return;
    }
    if (!agreed) {
      setError('נא לסמן שקראתם ואשרתם את ההצעה');
      return;
    }
    setSending(true);
    try {
      const response = await base44.functions.invoke('approveQuote', {
        type,
        id,
        token,
        name: name.trim(),
      });
      if (response.data?.error) {
        setError('האישור נכשל, נסו שוב');
        return;
      }
      justApproved.current = true;
      setQuote((prev) => ({
        ...prev,
        approved_at: response.data.approved_at,
        approved_name: response.data.approved_name,
      }));
      if (quote?.payment_url) setRedirectIn(3);
    } catch {
      setError('האישור נכשל, נסו שוב');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-[#6a6158]">טוען את ההצעה...</p>
        </div>
      </Shell>
    );
  }

  if (!quote) {
    return (
      <Shell>
        <div className="px-6 py-16 text-center">
          <p className="font-heading text-2xl text-[#5E1D1D]">הקישור לא תקין</p>
          <p className="text-sm text-[#6a6158] mt-2">
            אם קיבלתם קישור חדש, נסו לפתוח אותו מהמייל.
          </p>
        </div>
      </Shell>
    );
  }

  const depositLabel = quote.deposit ? shekel(quote.deposit) : '';

  return (
    <Shell>
      <div className="px-6 py-6">
        <p className="font-heading text-2xl text-[#5E1D1D]">הצעת מחיר, {quote.name || 'שלום'}</p>
        <p className="text-xs text-[#6a6158] mt-1 leading-relaxed">הנה סיכום ההצעה והבריף.</p>

        <div className="mt-4 bg-[#f0e8df] px-4 py-4">
          <p className="text-[11px] text-[#6a6158]">מחיר</p>
          <p className="font-heading text-3xl text-[#5E1D1D]">
            {quote.price != null ? shekel(quote.price) : 'לא צוין'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p className="text-[11px] text-[#6a6158]">מקדמה</p>
            <p className="font-heading text-lg">{depositLabel || 'לא צוין'}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#6a6158]">זמן אספקה</p>
            <p className="font-heading text-lg">{quote.delivery || 'לא צוין'}</p>
          </div>
        </div>

        <p className="text-sm font-bold text-[#5E1D1D] mt-5 mb-2">הבריף</p>
        <div className="bg-[#f0e8df] px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
          {quote.brief}
        </div>

        <div className="mt-5 border-r-4 border-[#5E1D1D] bg-[#f0e8df] px-4 py-3 text-sm leading-relaxed">
          <p className="font-bold text-[#5E1D1D]">העבודה מתחילה רק אחרי תשלום המקדמה</p>
          <p className="text-[#2a2622] mt-1">
            אחרי אישור ההצעה תועברו לתשלום המקדמה{depositLabel ? ` (${depositLabel})` : ''}. ברגע שהתשלום מתקבל אני משריינת לכם את הזמן ומתחילה לעבוד, ולוח הזמנים של האספקה נספר מאותו רגע.
          </p>
        </div>

        {quote.approved_at ? (
          <div className="mt-6 border-t border-dashed border-[#c9beb1] pt-5">
            <p className="flex items-center gap-2 font-heading text-xl text-[#4A6355]">
              <CheckCircle2 className="w-5 h-5" />
              ההצעה אושרה, תודה!
            </p>
            <p className="text-xs text-[#6a6158] mt-1">
              אושרה על ידי {quote.approved_name} · {formatDateTime(quote.approved_at)}
            </p>

            {quote.payment_url ? (
              <>
                {redirectIn !== null && redirectIn > 0 && (
                  <p className="text-sm text-[#2a2622] mt-3">
                    מעבירים אתכם לתשלום המקדמה בעוד {redirectIn} שניות...
                  </p>
                )}
                <a
                  href={quote.payment_url}
                  className="mt-4 flex w-full items-center justify-center gap-2 bg-[#5E1D1D] text-white text-sm font-bold px-6 py-3"
                >
                  <CreditCard className="w-4 h-4" />
                  {depositLabel ? `לתשלום המקדמה (${depositLabel})` : 'לתשלום המקדמה'}
                </a>
                <p className="text-[11px] text-[#6a6158] mt-2 text-center">
                  התשלום מתבצע בעמוד מאובטח של Grow
                </p>
              </>
            ) : (
              <p className="text-sm text-[#6a6158] mt-3">אחזור אלייך עם פרטי התשלום.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 border-t border-dashed border-[#c9beb1] pt-5">
            <p className="font-heading text-lg text-[#5E1D1D] mb-3">אישור ההצעה</p>

            <label className="block text-[11px] text-[#6a6158] mb-1" htmlFor="approver-name">
              שם מלא
            </label>
            <input
              id="approver-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-[#d9cfc2] text-[#2a2622] focus:outline-none focus:border-[#5E1D1D]"
            />

            <label className="flex items-start gap-2 mt-3 text-sm text-[#2a2622] cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1"
              />
              <span>קראתי את ההצעה ואני מאשר/ת אותה</span>
            </label>

            {error && <p className="text-xs text-[#a33] mt-2">{error}</p>}

            <button
              type="button"
              onClick={approve}
              disabled={sending}
              className="mt-4 w-full bg-[#5E1D1D] text-white text-sm font-bold px-6 py-3 disabled:opacity-60"
            >
              {sending ? 'מאשרים...' : quote.payment_url ? 'אישור ההצעה ומעבר לתשלום המקדמה' : 'אישור ההצעה'}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}