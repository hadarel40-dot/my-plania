import { forwardRef } from 'react';
import { formatDateTime } from '@/lib/formatDate';

const LOGO = 'https://media.base44.com/images/public/6ac284b25278ab1689bc08f5/69c9d343d_logo.png';
const WHATSAPP_URL = 'https://wa.me/972539306048';
const SITE_URL = 'https://hadarelifergan.com';
const EMAIL = 'planiasmartplan@gmail.com';

const BURGUNDY = '#5E1D1D';
const CREAM = '#faf6f1';
const SAND = '#f0e8df';
const GRAY = '#6a6158';
const INK = '#2a2622';
const SOFT = '#f0d9d9';

const label = { fontSize: 12, color: GRAY, margin: 0 };

function LinkButton({ href, children, variant = 'solid' }) {
  const solid = variant === 'solid';
  return (
    <a
      href={href}
      data-pdf-link={href}
      style={{
        display: 'inline-block',
        padding: '13px 28px',
        fontSize: 15,
        fontWeight: 700,
        textDecoration: 'none',
        background: solid ? BURGUNDY : 'transparent',
        color: solid ? '#fff' : BURGUNDY,
        border: `1.5px solid ${BURGUNDY}`,
        marginInlineStart: 10,
      }}
    >
      {children}
    </a>
  );
}

// A fixed 600px wide sheet that mirrors the quote email. It is rendered off screen
// and turned into the PDF; every element with data-pdf-link becomes a live link.
const QuotePdfSheet = forwardRef(function QuotePdfSheet({ record, quoteUrl, price, deposit }, ref) {
  return (
    <div
      ref={ref}
      dir="rtl"
      style={{ width: 600, background: SAND, fontFamily: 'Assistant, Arial, Helvetica, sans-serif', color: INK }}
    >
      <div
        style={{
          background: BURGUNDY,
          color: '#fff',
          padding: '22px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Plania’s</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: SOFT }}>תכנון חכם לבית, לטיולים ולעסקים</p>
        </div>
        <img src={LOGO} alt="" crossOrigin="anonymous" style={{ width: 72, height: 72, objectFit: 'contain' }} />
      </div>

      <div style={{ background: CREAM, padding: '36px 32px 8px' }}>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: BURGUNDY }}>
          הצעת מחיר, {record.name || 'שלום'}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: GRAY }}>
          נשלחה {formatDateTime(record.quote_sent_at)}. אפשר לאשר את ההצעה בלחיצה על הכפתור בסוף המסמך.
        </p>
      </div>

      <div style={{ background: CREAM, padding: '16px 32px 0' }}>
        <div style={{ background: SAND, padding: '22px 24px' }}>
          <p style={label}>מחיר</p>
          <p style={{ margin: '4px 0 0', fontSize: 40, fontWeight: 700, color: BURGUNDY }}>{price}</p>
        </div>
      </div>

      <div style={{ background: CREAM, padding: '18px 32px 4px', display: 'flex', gap: 32 }}>
        <div style={{ flex: 1 }}>
          <p style={label}>מקדמה</p>
          <p style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 700 }}>{deposit}</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={label}>זמן אספקה</p>
          <p style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 700 }}>{record.quote_delivery || 'לא צוין'}</p>
        </div>
      </div>

      <div style={{ background: CREAM, padding: '22px 32px 0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: BURGUNDY }}>הבריף</p>
        <div
          style={{
            background: SAND,
            padding: '20px 24px',
            fontSize: 14.5,
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
          }}
        >
          {record.quote_brief}
        </div>
      </div>

      <div style={{ background: CREAM, padding: '26px 32px 34px' }}>
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: BURGUNDY }}>
          העבודה מתחילה רק אחרי אישור ההצעה ותשלום המקדמה.
        </p>
        <div>
          {quoteUrl && <LinkButton href={quoteUrl}>לצפייה ואישור ההצעה</LinkButton>}
          {record.quote_payment_url && (
            <LinkButton href={record.quote_payment_url} variant="outline">
              לתשלום המקדמה
            </LinkButton>
          )}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: GRAY }}>
          שאלות?{' '}
          <a href={WHATSAPP_URL} data-pdf-link={WHATSAPP_URL} style={{ color: GRAY, textDecoration: 'underline' }}>
            אפשר לכתוב לי בוואטסאפ
          </a>
        </p>
      </div>

      <div style={{ background: BURGUNDY, color: '#fff', padding: '24px 32px' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>הדראל איפרגן</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: SOFT }}>
          053-9306048 ·{' '}
          <a href={`mailto:${EMAIL}`} data-pdf-link={`mailto:${EMAIL}`} style={{ color: SOFT, textDecoration: 'underline' }}>
            {EMAIL}
          </a>
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>
          <a href={SITE_URL} data-pdf-link={SITE_URL} style={{ color: SOFT, textDecoration: 'underline' }}>
            hadarelifergan.com
          </a>
        </p>
      </div>
    </div>
  );
});

export default QuotePdfSheet;
