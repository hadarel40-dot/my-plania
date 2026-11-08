import { Link } from 'react-router-dom';
import { Clock, ClipboardList, Mail, CheckCircle2 } from 'lucide-react';
import { waLink } from '@/lib/products';

const COPY = {
  travel: {
    path: '/q/travel',
    minutes: 'כ־15–20 דקות',
    what: 'מי נוסע, לאן ומתי, איזה סגנון טיול אתם אוהבים, איפה ישנים, כשרות ושבת ותקציב',
  },
  business: {
    path: '/q/business',
    minutes: 'כ־20–30 דקות',
    what: 'מה העסק עושה, מה צריך לבנות, מי הלקוחות שלכם, מה חשוב שיהיה, עיצוב ותקציב',
  },
};

const STEPS = [
  { icon: ClipboardList, text: 'ממלאים את השאלון וחותמים בסופו על ההסכם' },
  { icon: Mail, text: 'אני עוברת על התשובות ושולחת לכם הצעת מחיר ובריף למייל' },
  { icon: CheckCircle2, text: 'מאשרים את ההצעה, משלמים מקדמה, ואני מתחילה לעבוד' },
];

export default function StartQuestionnaire({ type, color, titleColor }) {
  const copy = COPY[type];
  if (!copy) return null;

  return (
    <section id="start" className="px-6 py-8 lg:px-14 lg:py-14 scroll-mt-20">
      <h2 className="font-heading text-2xl lg:text-3xl" style={{ color: titleColor }}>
        אני רוצה להתחיל
      </h2>
      <p className="text-[#2a2622] leading-relaxed mt-3 lg:text-lg">
        הכול מתחיל בשאלון אחד. אתם ממלאים אותו, ומחכים להצעת מחיר ממני.
      </p>

      <ol className="mt-6 grid gap-3 lg:grid-cols-3 lg:gap-5">
        {STEPS.map(({ icon: Icon, text }, i) => (
          <li
            key={text}
            className="relative bg-white border border-[#e3d9cc] px-5 pt-4 pb-5 border-t-4"
            style={{ borderTopColor: color }}
          >
            <div className="flex items-center justify-between">
              <span className="font-heading text-4xl lg:text-5xl leading-none" style={{ color: titleColor }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon className="w-6 h-6" style={{ color }} aria-hidden="true" />
            </div>
            <p className="text-sm lg:text-base leading-relaxed text-[#2a2622] mt-3">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-r-4 bg-[#f2ece4] px-5 py-4" style={{ borderRightColor: color }}>
        <p className="flex items-center gap-2 font-bold text-[#2a2622]">
          <Clock className="w-4 h-4" style={{ color: titleColor }} aria-hidden="true" />
          תפנו לשאלון זמן, {copy.minutes}
        </p>
        <p className="text-sm text-[#2a2622] leading-relaxed mt-2">
          השאלון שואל על {copy.what}. כדאי לשבת עליו ברוגע ולענות כמה שיותר בפירוט. ככל שהתשובות מדויקות
          יותר, ההצעה מדויקת יותר והעבודה עצמה לוקחת פחות זמן. אם יחסר לי משהו אשאל אתכם, אבל שאלון מלא
          חוסך את כל ההתכתבויות האלה.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          to={copy.path}
          className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl font-bold text-white shadow-[0_10px_25px_-10px_rgba(0,0,0,0.5)] transition hover:opacity-90 hover:-translate-y-0.5"
          style={{ background: titleColor }}
        >
          למילוי השאלון
        </Link>
        <a
          href={waLink('היי הדראל, יש לי שאלה לפני שאני ממלא/ת את השאלון')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#6a6158] underline underline-offset-4 text-center sm:text-right"
        >
          יש שאלה לפני? אפשר לכתוב לי בוואטסאפ
        </a>
      </div>
    </section>
  );
}
