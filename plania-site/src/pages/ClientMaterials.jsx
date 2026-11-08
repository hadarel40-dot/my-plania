import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Textarea } from '@/components/ui/textarea';
import MaterialsDropzone from '@/components/MaterialsDropzone';
import { formatDateTime } from '@/lib/formatDate';
import { LOGO_URL } from '@/lib/brand';
import useNoIndex from '@/hooks/useNoIndex';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/972539306048';
const BURGUNDY = '#5E1D1D';
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// The logo file is a square with the wordmark in the middle, so it is cropped to the wordmark.
function Logo({ className = '' }) {
  return (
    <span className={`relative block overflow-hidden ${className}`} style={{ aspectRatio: '383 / 98' }}>
      <img
        src={LOGO_URL}
        alt="Plania's"
        className="absolute max-w-none"
        style={{ width: '130.55%', left: '-17.23%', top: '-196.94%' }}
      />
    </span>
  );
}

function Shell({ children }) {
  return (
    <div dir="rtl" className="relative min-h-screen px-4 py-8 sm:py-12" style={{ background: '#f3ebe1' }}>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: GRAIN }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: 'radial-gradient(70% 100% at 50% 0%, rgba(255,251,246,0.95), rgba(255,251,246,0))' }}
      />
      <div className="relative mx-auto w-full max-w-[620px]">
        <div className="flex justify-center mb-6">
          <Logo className="w-44" />
        </div>
        <div
          className="bg-[#fffdfa] border border-[#e6dccd]"
          style={{ borderRadius: 14, boxShadow: '0 30px 60px -34px rgba(94,29,29,0.35)' }}
        >
          {children}
        </div>
        <p className="text-center text-xs text-[#6a6158] mt-6">
          שאלות? אפשר לכתוב לי{' '}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: BURGUNDY }}>
            בוואטסאפ
          </a>
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3">
      <h2 className="font-heading text-xl text-[#2a2622]">{children}</h2>
      {hint && <p className="text-xs text-[#6a6158] mt-0.5">{hint}</p>}
    </div>
  );
}

export default function ClientMaterials() {
  useNoIndex();
  const { token } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [item, setItem] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const load = () =>
    base44.functions
      .invoke('getClientPortal', { token })
      .then((response) => setData(response.data?.project ? response.data : null))
      .catch(() => setData(null));

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const items = data?.project?.requested_items || [];
  const receivedCount = useMemo(() => items.filter((entry) => entry.received).length, [items]);

  const send = async () => {
    setError('');
    setSent(false);
    if (!text.trim() && files.length === 0) {
      setError('נא לכתוב משהו או לצרף קובץ');
      return;
    }
    setSending(true);
    try {
      const response = await base44.functions.invoke('submitClientMaterial', {
        token,
        text,
        files,
        requested_item: item,
      });
      if (response.data?.success) {
        setText('');
        setItem('');
        setResetKey((value) => value + 1);
        setSent(true);
        await load();
      } else {
        setError('השליחה נכשלה, נסו שוב');
      }
    } catch (err) {
      const code = err?.response?.data?.error;
      setError(
        code === 'rate' || code === 'limit'
          ? 'נשלחו הרבה חומרים בזמן קצר. אפשר לנסות שוב בעוד כמה דקות, או לכתוב לי בוואטסאפ.'
          : 'השליחה נכשלה, נסו שוב'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="px-6 py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#6a6158]" />
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <p className="px-6 py-14 text-center text-sm text-[#6a6158] leading-relaxed">
          הקישור אינו תקין או שאינו פעיל.
          <br />
          אפשר לפנות אליי בוואטסאפ ואשלח קישור חדש.
        </p>
      </Shell>
    );
  }

  const { project, submissions } = data;

  return (
    <Shell>
      <div className="px-6 sm:px-8 pt-8 pb-2 text-center">
        <p className="font-script text-2xl" style={{ color: BURGUNDY }}>
          העלאת חומרים לפרויקט
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl text-[#2a2622] mt-1">שלום {project.name}</h1>
        {project.business_name && <p className="text-sm text-[#6a6158] mt-1">{project.business_name}</p>}
        {project.portal_note && (
          <p className="text-sm text-[#2a2622] leading-[1.9] mt-4 whitespace-pre-wrap">{project.portal_note}</p>
        )}
      </div>

      {items.length > 0 && (
        <section className="px-6 sm:px-8 pt-6">
          <SectionTitle hint={`${receivedCount} מתוך ${items.length} התקבלו`}>מה אני צריכה מכם</SectionTitle>
          <div className="h-1.5 bg-[#efe6da] mb-3" style={{ borderRadius: 3 }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${(receivedCount / items.length) * 100}%`,
                background: BURGUNDY,
                borderRadius: 3,
              }}
            />
          </div>
          <ul className="grid gap-2">
            {items.map((entry) => (
              <li
                key={entry.label}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm border"
                style={{
                  borderRadius: 8,
                  background: entry.received ? '#f2f6f3' : '#fff',
                  borderColor: entry.received ? '#cfdcd3' : '#e6dccd',
                }}
              >
                {entry.received ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#4A6355]" />
                ) : (
                  <Circle className="w-4 h-4 shrink-0 text-[#b9afa3]" />
                )}
                <span className={entry.received ? 'text-[#6a6158]' : 'text-[#2a2622]'}>{entry.label}</span>
                {entry.received && <span className="mr-auto text-[11px] text-[#4A6355]">התקבל</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-6 sm:px-8 pt-8">
        <SectionTitle hint="אפשר לשלוח כמה פעמים ולהוסיף בכל זמן">שליחת חומרים</SectionTitle>

        {items.length > 0 && (
          <div className="mb-4">
            <label className="text-xs text-[#6a6158] block mb-1">שייך ל (לא חובה)</label>
            <select
              value={item}
              onChange={(event) => setItem(event.target.value)}
              className="w-full h-11 px-3 text-sm bg-white border border-[#d9cfc2] text-[#2a2622]"
              style={{ borderRadius: 8 }}
            >
              <option value="">כללי</option>
              {items.map((entry) => (
                <option key={entry.label} value={entry.label}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <MaterialsDropzone onChange={setFiles} onBusyChange={setUploading} accent={BURGUNDY} resetKey={resetKey} />

        <div className="mt-4">
          <label className="text-xs text-[#6a6158] block mb-1">טקסט, הערות וקישורים</label>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="כל מה שחשוב לכם שאדע: טקסטים לאתר, בקשות, קישורים להשראה"
            rows={6}
            className="text-sm bg-white border-[#d9cfc2]"
            style={{ borderRadius: 8 }}
          />
        </div>

        <p className="text-xs text-[#6a6158] mt-3">
          בבקשה לא לשלוח כאן סיסמאות. אם צריך גישה לחשבון, נתאם את זה בנפרד.
        </p>

        {error && <p className="text-sm text-[#a33] mt-3">{error}</p>}
        {sent && (
          <div
            className="mt-4 flex items-center gap-2 px-3 py-2.5 text-sm text-[#2f4a3b] bg-[#f2f6f3] border border-[#cfdcd3]"
            style={{ borderRadius: 8 }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            התקבל, תודה. אפשר להוסיף עוד בכל זמן.
          </div>
        )}

        <button
          type="button"
          onClick={send}
          disabled={sending || uploading}
          className="mt-5 w-full h-12 text-sm font-bold text-white transition-colors hover:bg-[#4a1717] disabled:opacity-60"
          style={{ background: BURGUNDY, borderRadius: 8 }}
        >
          {sending ? 'שולח...' : uploading ? 'ממתינים לסיום ההעלאה...' : 'שליחה'}
        </button>
      </section>

      {submissions.length > 0 ? (
        <section className="px-6 sm:px-8 pt-8 pb-8">
          <SectionTitle>מה כבר נשלח</SectionTitle>
          <ul className="space-y-2.5">
            {submissions.map((entry, index) => (
              <li
                key={index}
                className="bg-white border border-[#e6dccd] px-3.5 py-3"
                style={{ borderRadius: 8 }}
              >
                <p className="text-[11px] text-[#6a6158]">
                  {formatDateTime(entry.at)}
                  {entry.requested_item ? ` · ${entry.requested_item}` : ''}
                </p>
                {entry.text && <p className="text-sm text-[#2a2622] whitespace-pre-wrap mt-1">{entry.text}</p>}
                {entry.files.length > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: BURGUNDY }}>
                    {entry.files.join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="pb-8" />
      )}
    </Shell>
  );
}
