import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import FormErrorNotice from '@/components/FormErrorNotice';
import { todayISO } from '@/lib/formatDate';
import { getAttribution } from '@/lib/attribution';

const inputClass =
  'w-full bg-[#f2ece4] border border-[#e3d9cc] px-4 py-3 text-sm text-[#2a2622] placeholder:text-[#8a8079] focus:outline-none focus:border-[#5E1D1D]';

export default function LeadForm({ service, color, titleColor }) {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setFailed(false);
    setSending(true);
    try {
      await base44.entities.Lead.create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
        service,
        status: 'ליד חדש',
        follow_up_date: todayISO(),
        ...getAttribution(),
      });
      setSent(true);
      try {
        await base44.functions.invoke('submitLead', { ...form, service });
      } catch {
        // המייל הוא תוספת בלבד – הפנייה כבר נשמרה
      }
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="px-6 py-7">
      <h2 className="font-heading text-xl mb-1" style={{ color: titleColor }}>
        רוצה שנדבר?
      </h2>
      <p className="text-sm text-[#6a6158] mb-4">השאירו פרטים ואחזור אליכם.</p>

      {sent ? (
        <p className="bg-[#f2ece4] px-4 py-6 text-center text-[#2a2622] leading-relaxed">
          תודה! אחזור אלייך תוך יום-יומיים.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            value={form.name}
            onChange={update('name')}
            placeholder="שם מלא *"
            className={inputClass}
          />
          <input
            type="tel"
            required
            value={form.phone}
            onChange={update('phone')}
            placeholder="טלפון *"
            className={inputClass}
          />
          <textarea
            rows={3}
            value={form.message}
            onChange={update('message')}
            placeholder="במה אפשר לעזור?"
            className={inputClass}
          />
          <p className="text-xs text-[#6a6158] leading-relaxed">
            הפרטים ישמשו כדי לחזור אליכם בנוגע לפנייה. בשליחת הטופס אתם מאשרים את{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              מדיניות הפרטיות
            </a>
            .
          </p>
          {failed && <FormErrorNotice color={color} />}
          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: color }}
          >
            {sending ? 'שולחים...' : 'שליחה'}
          </button>
        </form>
      )}
    </section>
  );
}