import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion';
import { Check, ClipboardList, FolderUp, Heart, MessageCircle, Palette, Plug, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import FormErrorNotice from '@/components/FormErrorNotice';
import { todayISO } from '@/lib/formatDate';
import { getAttribution } from '@/lib/attribution';

/**
 * דף הנחיתה של "מנהלת הסושיאל של Plania's": פלאגין ל-Claude שמכין כל שבוע פוסטים לאינסטגרם.
 * בשלב הזה: הרשמה לבודקות הראשונות. ההרשמות נשמרות כלידים (service: social).
 * הדף בנוי בשכבות: רקע זז, טלפון עם ריל חי, כרטיסים שצפים לפי העכבר, ואנימציות שמגיבות לגלילה.
 * מי שביקשה פחות תנועה במכשיר מקבלת דף שקט.
 */

const B = '#5E1D1D';
const ROSE = '#B5848E';
const PINK = '#F7C9D6';
const EASE = [0.22, 1, 0.36, 1];

// ---------- כלים קטנים

function useLayer(mx, my, depth) {
  const x = useSpring(useTransform(mx, (v) => v * depth), { stiffness: 80, damping: 18 });
  const y = useSpring(useTransform(my, (v) => v * depth), { stiffness: 80, damping: 18 });
  return { x, y };
}

function Float({ children, delay = 0, amp = 8, dur = 5, className = '', style }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      animate={reduce ? undefined : { y: [0, -amp, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

function Rise({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// קו בכתב יד שנכתב לאט, כמו הקו בלוגו
function Swoosh({ className = '', color = B, delay = 0.6 }) {
  return (
    <svg viewBox="0 0 300 24" className={className} fill="none" aria-hidden>
      <motion.path
        d="M4 16 C 70 6, 160 4, 296 10 M 40 20 C 120 12, 200 12, 270 16"
        stroke={color} strokeWidth="2.4" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, delay, ease: 'easeInOut' }}
      />
    </svg>
  );
}

function Eyebrow({ children, light = false }) {
  return (
    <p className={`inline-flex items-center gap-2 text-xs lg:text-sm font-bold tracking-wide ${light ? 'text-[#f6efe6]/80' : ''}`} style={light ? undefined : { color: ROSE }}>
      <span className="w-6 h-[2px]" style={{ background: light ? '#f6efe6' : ROSE }} />
      {children}
    </p>
  );
}

function H2({ children, light = false, className = '' }) {
  return (
    <h2 className={`font-heading text-3xl md:text-4xl lg:text-5xl leading-[1.1] mt-3 ${className}`} style={{ color: light ? '#faf6f1' : B, textWrap: 'balance' }}>
      {children}
    </h2>
  );
}

// ---------- הריל שבתוך הטלפון: שלושה סגנונות כתוביות, כמו במוצר

const REEL = {
  pop: ['ככה', 'נראה', 'שבוע', 'של', 'תוכן'],
  chips: { head: 'השבוע שלי בתוכן', body: ['בלי', 'לשבת', 'על', 'זה', 'בלילה'] },
  lines: ['ככה נראה שבוע של תוכן', 'בלי לשבת על זה בלילה'],
};

function ReelScreen({ style = 'pop' }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = setInterval(() => setI((n) => n + 1), style === 'lines' ? 1600 : 700);
    return () => clearInterval(t);
  }, [style]);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(170deg,#caa08f 0%,#a5675f 38%,#5E1D1D 78%,#2a1212 100%)' }}>
      {/* "צילום": אורות רכים שזזים לאט, כמו סרטון אמיתי */}
      <motion.div
        aria-hidden
        className="absolute -inset-10"
        animate={reduce ? undefined : { scale: [1, 1.12, 1], rotate: [0, 3, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(40% 30% at 30% 30%, rgba(255,236,220,.55), transparent 70%), radial-gradient(35% 25% at 75% 60%, rgba(247,201,214,.45), transparent 70%), radial-gradient(30% 22% at 40% 85%, rgba(255,255,255,.18), transparent 70%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-1 bg-white/25"><motion.div key={style} className="h-full bg-white/80" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }} /></div>
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-full bg-[#faf6f1] border-2 border-white/80" />
        <span className="text-[10px] font-bold text-white/90">העסק שלך</span>
      </div>

      {style === 'pop' && (
        <div className="absolute inset-x-0 top-[44%] flex justify-center">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={i}
              initial={{ scale: 0.4, opacity: 0, rotate: -4 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              className="font-heading text-[42px] leading-none text-white"
              style={{ WebkitTextStroke: `1.5px ${PINK}`, textShadow: '0 4px 14px rgba(0,0,0,.45)' }}
            >
              {REEL.pop[i % REEL.pop.length]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {style === 'chips' && (
        <div className="absolute inset-x-3 top-[34%] text-center">
          <motion.span key="h" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block px-3 py-1.5 rounded-md font-bold text-[15px]" style={{ background: PINK, color: B }}>
            {REEL.chips.head}
          </motion.span>
          <p className="mt-3 text-white font-bold text-[17px] leading-snug" style={{ textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>
            {REEL.chips.body.map((w, k) => (
              <motion.span key={k} className="inline-block mx-[3px]" animate={{ opacity: k <= i % (REEL.chips.body.length + 2) ? 1 : 0.15 }} transition={{ duration: 0.25 }}>
                {w}
              </motion.span>
            ))}
          </p>
        </div>
      )}

      {style === 'lines' && (
        <div className="absolute inset-x-4 bottom-[22%] text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={i % REEL.lines.length}
              initial={{ y: 14, opacity: 0, filter: 'blur(4px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="text-white font-bold text-[17px] leading-snug"
              style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}
            >
              {REEL.lines[i % REEL.lines.length]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      <div className="absolute left-2.5 bottom-16 flex flex-col items-center gap-3 text-white/90">
        <Heart className="w-5 h-5" />
        <MessageCircle className="w-5 h-5" />
      </div>
    </div>
  );
}

function Phone({ style, className = '' }) {
  return (
    <div className={`relative w-[210px] lg:w-[240px] aspect-[9/19] rounded-[38px] bg-[#1d0c0c] p-[9px] shadow-[0_40px_80px_-30px_rgba(60,10,10,0.75),inset_0_0_0_1.5px_rgba(255,255,255,0.08)] ${className}`}>
      <div className="relative w-full h-full rounded-[30px] overflow-hidden">
        <ReelScreen style={style} />
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-[#1d0c0c]" />
      </div>
    </div>
  );
}

// ---------- 1. פתיחה בשכבות

function Hero() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const far = useLayer(mx, my, -14);
  const mid = useLayer(mx, my, 22);
  const near = useLayer(mx, my, 38);
  const move = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const words = ['מנהלת', 'הסושיאל'];

  return (
    <section onMouseMove={move} className="relative overflow-hidden px-5 pt-6 pb-16 lg:pt-12 lg:pb-24">
      {/* שכבת רקע: כתמי אור שזזים לאט, וגרעין של נייר */}
      <motion.div aria-hidden style={far} className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[520px] h-[520px] rounded-full blur-3xl opacity-60"
          style={{ background: `radial-gradient(circle, ${PINK} 0%, transparent 65%)`, top: '-12%', right: '-10%' }}
          animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[460px] h-[460px] rounded-full blur-3xl opacity-40"
          style={{ background: `radial-gradient(circle, ${ROSE} 0%, transparent 65%)`, bottom: '-18%', left: '-8%' }}
          animate={reduce ? undefined : { x: [0, -30, 0], y: [0, -24, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      <div className="relative mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px] lg:grid lg:grid-cols-[1fr_520px] lg:gap-10 lg:items-center">
        <div className="text-center lg:text-right">
          <motion.span
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 text-xs lg:text-sm font-bold tracking-wide rounded-full px-4 py-1.5 bg-[#faf6f1]/80 backdrop-blur border"
            style={{ color: B, borderColor: `${B}40` }}
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: ROSE }} />
              <span className="relative w-2 h-2 rounded-full" style={{ background: B }} />
            </span>
            פלאגין ל-Claude · הרשמה לבודקות הראשונות
          </motion.span>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.8 }} className="font-heading text-xl lg:text-2xl mt-6" style={{ color: ROSE }}>
            התוכן של השבוע הבא, כבר מוכן.
          </motion.p>

          <h1 className="font-heading text-[56px] md:text-7xl lg:text-[88px] leading-[0.98] mt-2" style={{ color: B }} aria-label="מנהלת הסושיאל של Plania's">
            {words.map((w, k) => (
              <span key={w} className="inline-block overflow-hidden align-bottom ml-3 last:ml-0" aria-hidden>
                <motion.span
                  className="inline-block"
                  initial={{ y: '105%', filter: 'blur(6px)' }}
                  animate={{ y: '0%', filter: 'blur(0px)' }}
                  transition={{ duration: 0.9, delay: 0.25 + k * 0.12, ease: EASE }}
                >
                  {w}
                </motion.span>
              </span>
            ))}
            <motion.span
              aria-hidden
              className="block text-3xl md:text-4xl lg:text-5xl mt-3 relative w-fit mx-auto lg:mx-0"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.8, ease: EASE }}
            >
              של Plania&apos;s
              <Swoosh className="absolute -bottom-4 right-0 w-full h-5" delay={1} />
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8, ease: EASE }}
            className="text-[#2a2622] leading-relaxed mt-9 lg:text-lg max-w-[540px] mx-auto lg:mx-0"
          >
            כל שבוע היא מתכננת, כותבת ומעצבת לך ארבעה פוסטים לאינסטגרם: קרוסלות ורילס עם כתוביות מונפשות, מהתמונות והסרטונים שלך ובקול שלך. הכול קורה בתוך ה-Claude שלך.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.8, ease: EASE }} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <a href="#join" className="group relative inline-flex items-center justify-center overflow-hidden px-8 py-4 rounded-2xl font-bold text-[#faf6f1] shadow-[0_14px_30px_-12px_rgba(94,29,29,0.8)] transition hover:-translate-y-0.5" style={{ background: B }}>
              <span aria-hidden className="absolute inset-y-0 -right-1/2 w-1/3 skew-x-[-20deg] bg-white/25 transition-all duration-700 group-hover:right-[130%]" />
              <span className="relative">אני רוצה להיות מהראשונות</span>
            </a>
            <a href="#how" className="inline-flex items-center justify-center px-7 py-4 rounded-2xl font-bold border-2 bg-[#faf6f1]/60 backdrop-blur transition hover:bg-[#5E1D1D] hover:text-[#faf6f1]" style={{ color: B, borderColor: B }}>
              איך זה עובד
            </a>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="text-sm text-[#6a6158] mt-4">
            הבודקות הראשונות מקבלות את הפלאגין בחינם, בתמורה לפידבק כן.
          </motion.p>
        </div>

        {/* הבמה: טלפון עם ריל חי, וכרטיסים שצפים סביבו בעומקים שונים */}
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 1, ease: EASE }} className="relative mx-auto mt-14 lg:mt-0 h-[480px] lg:h-[560px] w-full max-w-[400px] lg:max-w-[520px]">
          <motion.div style={mid} className="absolute inset-0 flex items-center justify-center">
            <Phone style="pop" />
          </motion.div>

          <motion.div style={near} className="absolute top-[8%] right-0 lg:right-2">
            <Float dur={6} amp={10}>
              <div className="w-[128px] lg:w-[150px] aspect-[4/5] rounded-xl bg-[#faf6f1] shadow-[0_24px_44px_-18px_rgba(60,10,10,0.55)] rotate-[7deg] p-2.5 flex flex-col">
                <div className="flex-1 rounded-lg" style={{ background: 'linear-gradient(150deg,#e9cfc4,#c79b92)' }} />
                <p className="font-heading text-[13px] lg:text-[15px] leading-tight mt-2" style={{ color: B }}>3 דברים שלמדתי</p>
                <div className="flex gap-1 mt-1.5">{[0, 1, 2, 3, 4].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: d === 0 ? B : `${B}33` }} />)}</div>
              </div>
            </Float>
          </motion.div>

          <motion.div style={near} className="absolute bottom-[14%] left-0 lg:-left-2">
            <Float dur={5.5} delay={0.6} amp={9}>
              <div className="w-[176px] rounded-2xl bg-white/90 backdrop-blur p-3 shadow-[0_22px_40px_-18px_rgba(60,10,10,0.5)] -rotate-[4deg]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: B }}><Check className="w-3.5 h-3.5" /></span>
                  <p className="text-xs font-bold" style={{ color: B }}>הכיתוב מוכן</p>
                </div>
                <div className="mt-2 space-y-1.5"><div className="h-1.5 rounded bg-[#e3d9cc] w-full" /><div className="h-1.5 rounded bg-[#e3d9cc] w-4/5" /><div className="h-1.5 rounded bg-[#e3d9cc] w-3/5" /></div>
              </div>
            </Float>
          </motion.div>

          <motion.div style={far} className="absolute top-[2%] left-[6%]">
            <Float dur={7} delay={0.3} amp={6}>
              <WeekChip />
            </Float>
          </motion.div>

          <motion.div style={mid} className="absolute bottom-[4%] right-[8%]">
            <Float dur={6.5} delay={1} amp={7}>
              <div className="flex items-center gap-2 rounded-full bg-[#faf6f1] border border-[#e3d9cc] pl-3 pr-1.5 py-1.5 shadow-[0_14px_30px_-16px_rgba(60,10,10,0.5)]">
                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${ROSE}33`, color: B }}><FolderUp className="w-4 h-4" /></span>
                <span className="text-xs font-bold" style={{ color: B }}>חומרים מהדרייב</span>
                <span className="flex -space-x-1.5 space-x-reverse">{['#d9b2a6', '#b77f78', '#8e4a49'].map((c) => <span key={c} className="w-5 h-5 rounded-md border-2 border-[#faf6f1]" style={{ background: c }} />)}</span>
              </div>
            </Float>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function WeekChip() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % 6), 900);
    return () => clearInterval(t);
  }, []);
  const done = Math.min(n, 4);
  return (
    <div className="rounded-2xl bg-[#faf6f1] border border-[#e3d9cc] px-3.5 py-2.5 shadow-[0_14px_30px_-16px_rgba(60,10,10,0.5)]">
      <p className="text-[11px] font-bold" style={{ color: B }}>השבוע: {done} מתוך 4 מוכנים</p>
      <div className="flex gap-1.5 mt-1.5">
        {[0, 1, 2, 3].map((k) => (
          <motion.span key={k} className="w-7 h-2 rounded-full" animate={{ background: k < done ? B : '#e3d9cc' }} transition={{ duration: 0.3 }} />
        ))}
      </div>
    </div>
  );
}

// ---------- 2. פס רץ

const TICKER = ['סיפור אישי', 'ויראלי', 'ערך', 'אמון והוכחה', 'קרוסלות במותג שלך', 'רילס עם כתוביות', 'כיתובים בקול שלך', 'לומדת ממה שעבד'];

function Ticker() {
  const reduce = useReducedMotion();
  const row = [...TICKER, ...TICKER];
  return (
    <div className="relative overflow-hidden py-4 -rotate-[1.2deg] scale-x-[1.08]" style={{ background: B }} aria-hidden>
      <motion.div
        className="flex w-max gap-8 whitespace-nowrap"
        animate={reduce ? undefined : { x: ['0%', '50%'] }}
        transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
      >
        {[...row, ...row].map((t, k) => (
          <span key={k} className="flex items-center gap-8 font-heading text-xl lg:text-2xl text-[#faf6f1]">
            {t}
            <Sparkles className="w-4 h-4" style={{ color: PINK }} />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ---------- 3. היום / עם מנהלת הסושיאל

const BEFORE_AFTER = [
  ['יושבת מול המסך ולא יודעת מה לכתוב', 'ארבעה פוסטים מחכים לך בתחילת השבוע'],
  ['הגלריה מלאה, ושום דבר לא עולה', 'התמונות והסרטונים מהדרייב הופכים לקרוסלות ורילס'],
  ['טקסטים של ChatGPT שלא נשמעים כמוך', 'כיתובים בקול שלך, שלומדים ממה שאהבת'],
  ['שבוע של שלושה פוסטים, ואז חודש של שקט', 'פוסט מכל סוג, כל שבוע'],
  ['מנהלת סושיאל שהעסק עוד לא יכול להרשות לעצמו', 'מנהלת סושיאל שגרה בתוך ה-Claude שלך'],
];

function BeforeAfter() {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  const [after, setAfter] = useState(false);
  // פעם אחת, כשמגיעים לחלק הזה: מתחלף לבד ל"עם", כדי שיראו את ההבדל
  useEffect(() => {
    if (!seen) return undefined;
    const t = setTimeout(() => setAfter(true), 1600);
    return () => clearTimeout(t);
  }, [seen]);

  return (
    <section ref={ref} className="px-5 py-20 lg:py-28">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[920px]">
        <Rise className="text-center">
          <Eyebrow>זה בשבילך אם</Eyebrow>
          <H2>מכירה את זה?</H2>
        </Rise>

        <Rise delay={0.1} className="mt-8 flex justify-center">
          <div role="tablist" aria-label="היום מול עם מנהלת הסושיאל" className="relative grid grid-cols-2 rounded-full bg-[#faf6f1] border border-[#e3d9cc] p-1 w-full max-w-[380px]">
            {[['היום', false], ['עם מנהלת הסושיאל', true]].map(([label, v]) => (
              <button key={label} type="button" role="tab" aria-selected={after === v} onClick={() => setAfter(v)} className="relative z-10 py-2.5 px-3 rounded-full text-sm font-bold transition-colors" style={{ color: after === v ? '#faf6f1' : B }}>
                {after === v && <motion.span layoutId="ba-pill" className="absolute inset-0 rounded-full -z-10" style={{ background: B }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                {label}
              </button>
            ))}
          </div>
        </Rise>

        <ul className="mt-8 space-y-3">
          {BEFORE_AFTER.map(([b, a], k) => (
            <Rise key={k} delay={0.05 * k}>
              <li className="relative overflow-hidden rounded-2xl border px-5 py-4 lg:px-7 lg:py-5 transition-colors duration-500" style={{ background: after ? '#faf6f1' : '#f2ece4', borderColor: after ? `${ROSE}80` : '#e3d9cc' }}>
                <div className="flex items-center gap-4">
                  <motion.span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" animate={{ background: after ? B : '#e3d9cc', rotate: after ? 0 : -90 }} transition={{ duration: 0.4, delay: k * 0.06 }}>
                    {after ? <Check className="w-4 h-4 text-[#faf6f1]" /> : <span className="w-3 h-[2px] bg-[#8a8079]" />}
                  </motion.span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={after ? 'a' : 'b'}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35, delay: k * 0.06 }}
                      className={`lg:text-lg leading-relaxed ${after ? 'font-bold text-[#2a2622]' : 'text-[#6a6158]'}`}
                    >
                      {after ? a : b}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </li>
            </Rise>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- 4. איך זה עובד: קו שמתמלא עם הגלילה

const STEPS = [
  [Plug, 'מתקינים ומחברים', 'מוסיפים את הפלאגין ל-Claude ומחברים את הדרייב שלך. כמה לחיצות, בלי קוד.'],
  [ClipboardList, 'שאלון על העסק', 'מה את מוכרת, למי, איך את מדברת, ומה הצבעים והגופנים שלך. ככה היא מכירה אותך.'],
  [FolderUp, 'מעלים חומרים', 'זורקים לתיקייה בדרייב תמונות וסרטונים מהשבוע. לא צריך לסדר.'],
  [Sparkles, 'מקבלים את השבוע', 'ארבעה פוסטים, כל אחד בכמה גרסאות. בוחרים, שולחים לאינסטגרם מהטלפון, מוסיפים מוזיקה ומפרסמים.'],
];

function HowItWorks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.55'] });
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });

  return (
    <section id="how" className="scroll-mt-24 relative px-5 py-20 lg:py-28 bg-[#faf6f1]">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[920px]">
        <Rise className="text-center">
          <Eyebrow>איך זה עובד</Eyebrow>
          <H2>ארבעה צעדים, ואז זה פשוט קורה</H2>
        </Rise>
        <div ref={ref} className="relative mt-14">
          <div className="absolute top-2 bottom-2 right-[23px] lg:right-1/2 lg:translate-x-1/2 w-[3px] rounded-full bg-[#e3d9cc]" />
          <motion.div className="absolute top-2 bottom-2 right-[23px] lg:right-1/2 lg:translate-x-1/2 w-[3px] rounded-full origin-top" style={{ background: B, scaleY: fill }} />
          <ol className="space-y-10 lg:space-y-16">
            {STEPS.map(([Icon, t, d], k) => (
              <li key={t} className={`relative flex gap-5 lg:w-1/2 ${k % 2 ? 'lg:mr-auto lg:pr-12' : 'lg:ml-auto lg:pl-12 lg:flex-row-reverse lg:text-left'}`}>
                <StepDot progress={scrollYProgress} at={(k + 0.3) / STEPS.length} n={k + 1} className={`lg:absolute lg:top-0 ${k % 2 ? 'lg:-right-6' : 'lg:-left-6'}`} />
                <Rise className="flex-1 rounded-2xl bg-white/80 border border-[#e3d9cc] p-5 lg:p-6 shadow-[0_18px_40px_-28px_rgba(60,10,10,0.5)]">
                  <span className="inline-flex w-10 h-10 rounded-xl items-center justify-center" style={{ background: `${ROSE}26`, color: B }}><Icon className="w-5 h-5" /></span>
                  <p className="font-heading text-2xl mt-3" style={{ color: B }}>{t}</p>
                  <p className="text-[#2a2622] leading-relaxed mt-1">{d}</p>
                </Rise>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepDot({ progress, at, n, className = '' }) {
  const [on, setOn] = useState(false);
  useEffect(() => progress.on('change', (v) => setOn(v >= at)), [progress, at]);
  return (
    <motion.span
      className={`relative z-10 shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-[3px] ${className}`}
      animate={{ background: on ? B : '#faf6f1', color: on ? '#faf6f1' : B, borderColor: on ? B : '#e3d9cc', scale: on ? 1 : 0.9 }}
      transition={{ duration: 0.35 }}
    >
      {n}
    </motion.span>
  );
}

// ---------- 5. שלושה סגנונות כתוביות, לבחור ולראות

const STYLES = [
  ['pop', 'מילה גדולה', 'מילה אחת בכל פעם, קופצת. הכי עוצר גלילה.'],
  ['chips', 'כותרת בתיבה', 'כותרת ורודה מעל, והמילים נדלקות מתחת.'],
  ['lines', 'שורות', 'משפט שלם בכל פעם, רגוע וקריא.'],
];

function CaptionStyles() {
  const [s, setS] = useState('pop');
  return (
    <section className="relative overflow-hidden px-5 py-20 lg:py-28" style={{ background: `linear-gradient(180deg, #f0e8df 0%, #ead9d3 100%)` }}>
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1000px] lg:grid lg:grid-cols-[1fr_300px] lg:gap-16 lg:items-center">
        <div>
          <Rise className="text-center lg:text-right">
            <Eyebrow>רילס שמרגישים חיים</Eyebrow>
            <H2>כתוביות שזזות, בסגנון שבחרת</H2>
            <p className="text-[#6a6158] leading-relaxed mt-4 lg:text-lg">רילס נבנים רק מהסרטונים שלך, בלי מצגת של תמונות. בוחרים סגנון כתוביות, ואפשר להחליף בכל פוסט.</p>
          </Rise>
          <div className="mt-8 space-y-3" role="radiogroup" aria-label="סגנון כתוביות">
            {STYLES.map(([id, name, desc]) => (
              <button
                key={id} type="button" role="radio" aria-checked={s === id} onClick={() => setS(id)}
                className="relative w-full text-right rounded-2xl px-5 py-4 border transition-colors"
                style={{ borderColor: s === id ? B : '#e3d9cc', background: s === id ? '#faf6f1' : 'rgba(250,246,241,.5)' }}
              >
                {s === id && <motion.span layoutId="style-bar" className="absolute right-0 top-3 bottom-3 w-1 rounded-full" style={{ background: B }} />}
                <span className="font-heading text-xl block" style={{ color: B }}>{name}</span>
                <span className="text-sm text-[#6a6158]">{desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-12 lg:mt-0 flex justify-center">
          <Phone style={s} />
        </div>
      </div>
    </section>
  );
}

// ---------- 6. ארבעה סוגי תוכן: כרטיסים שמתהפכים

const TYPES = [
  ['סיפור אישי', 'מה שקורה לך באמת, ולמה זה קשור למה שאת מוכרת', 'השנה הראשונה שלי עם העסק לא נראתה ככה'],
  ['ויראלי', 'רגע שגורם לעצור את הגלילה ולשתף', 'רגע לפני שאת גוללת הלאה'],
  ['ערך', 'משהו שהעוקבות שומרות כי הוא עוזר להן', '3 דברים שהייתי רוצה לדעת לפני שהתחלתי'],
  ['אמון והוכחה', 'לקוחות, תוצאות ומאחורי הקלעים', 'מה לקוחה כתבה לי השבוע'],
];

function FlipCard({ type, desc, hook, delay }) {
  const [flip, setFlip] = useState(false);
  return (
    <Rise delay={delay}>
      <button
        type="button" onClick={() => setFlip((v) => !v)} onMouseEnter={() => setFlip(true)} onMouseLeave={() => setFlip(false)}
        aria-label={`${type}: ${desc}. דוגמה: ${hook}`}
        className="relative w-full h-[210px] lg:h-[260px] [perspective:1200px] text-right"
      >
        <motion.div className="absolute inset-0 [transform-style:preserve-3d]" animate={{ rotateY: flip ? 180 : 0 }} transition={{ duration: 0.7, ease: EASE }}>
          <div className="absolute inset-0 [backface-visibility:hidden] rounded-2xl bg-[#faf6f1] border border-[#e3d9cc] p-6 flex flex-col justify-between shadow-[0_18px_40px_-28px_rgba(60,10,10,0.5)]">
            <span className="w-10 h-1 rounded-full" style={{ background: ROSE }} />
            <div>
              <p className="font-heading text-3xl" style={{ color: B }}>{type}</p>
              <p className="text-[#6a6158] leading-relaxed mt-2">{desc}</p>
            </div>
            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: ROSE }}><RefreshCw className="w-3.5 h-3.5" />לראות דוגמה</span>
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl p-6 flex flex-col justify-center text-[#faf6f1]" style={{ background: `linear-gradient(160deg, #7a2f2f, ${B})` }}>
            <p className="text-xs font-bold text-[#f6efe6]/70">משפט פתיחה לדוגמה</p>
            <p className="font-heading text-2xl lg:text-[26px] leading-snug mt-2">{hook}</p>
          </div>
        </motion.div>
      </button>
    </Rise>
  );
}

function ContentTypes() {
  return (
    <section className="px-5 py-20 lg:py-28">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px]">
        <Rise className="text-center max-w-[640px] mx-auto">
          <Eyebrow>ארבעה סוגי תוכן, כל שבוע</Eyebrow>
          <H2>עמוד שמעלה רק טיפים נשכח. עמוד שמעלה רק סיפורים לא מוכר.</H2>
          <p className="text-[#6a6158] leading-relaxed mt-4 lg:text-lg">היא מאזנת בשבילך: פוסט אחד מכל סוג. לגעת בכרטיס כדי לראות דוגמה.</p>
        </Rise>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map(([t, d, h], k) => <FlipCard key={t} type={t} desc={d} hook={h} delay={k * 0.08} />)}
        </div>
      </div>
    </section>
  );
}

// ---------- 7. קרוסלה שאפשר להחליק

const SLIDES = [
  { kind: 'cover', title: '3 דברים שלמדתי בשנה הראשונה של העסק' },
  { kind: 'point', n: '1', title: 'לא צריך להיות מושלמת', body: 'הפוסט שהעליתי בלי לחשוב פעמיים קיבל הכי הרבה תגובות.' },
  { kind: 'point', n: '2', title: 'לספר מה קורה באמת', body: 'אנשים קונים מאנשים. גם מהבלגן.' },
  { kind: 'point', n: '3', title: 'עקביות מנצחת', body: 'פוסט אחד כל שבוע עדיף על חמישה ואז חודש של שקט.' },
  { kind: 'cta', title: 'שמרי את הפוסט', body: 'ותגידי לי בתגובות מה מהם הכי קשה לך' },
];

function SlideFace({ s }) {
  if (s.kind === 'cover') {
    return (
      <div className="w-full h-full flex flex-col p-6" style={{ background: `linear-gradient(170deg, #7a2f2f, ${B} 70%)` }}>
        <div className="flex-1 rounded-xl" style={{ background: 'radial-gradient(60% 60% at 40% 40%, rgba(247,201,214,.55), transparent 70%), linear-gradient(150deg,#c99a8a,#8e4a49)' }} />
        <p className="font-heading text-[28px] leading-tight text-[#faf6f1] mt-4">{s.title}</p>
        <p className="text-xs text-[#f6efe6]/70 mt-2">להחליק ←</p>
      </div>
    );
  }
  if (s.kind === 'cta') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-[#f2ece4]">
        <span className="w-14 h-14 rounded-full flex items-center justify-center text-[#faf6f1]" style={{ background: B }}><Heart className="w-6 h-6" /></span>
        <p className="font-heading text-3xl mt-4" style={{ color: B }}>{s.title}</p>
        <p className="text-[#6a6158] mt-2">{s.body}</p>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex flex-col p-6 bg-[#faf6f1]">
      <span className="font-heading text-7xl leading-none" style={{ color: ROSE }}>{s.n}</span>
      <div className="h-24 rounded-xl mt-3" style={{ background: 'linear-gradient(150deg,#e9cfc4,#c79b92)' }} />
      <p className="font-heading text-2xl mt-4" style={{ color: B }}>{s.title}</p>
      <p className="text-[#2a2622] leading-relaxed mt-1">{s.body}</p>
    </div>
  );
}

function SwipeCarousel() {
  const [i, setI] = useState(0);
  const go = (d) => setI((v) => Math.max(0, Math.min(SLIDES.length - 1, v + d)));
  return (
    <section className="relative overflow-hidden px-5 py-20 lg:py-28 bg-[#faf6f1]">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1000px] lg:grid lg:grid-cols-[1fr_340px] lg:gap-16 lg:items-center">
        <Rise className="text-center lg:text-right">
          <Eyebrow>קרוסלות</Eyebrow>
          <H2>קרוסלה אמיתית, במותג שלך</H2>
          <p className="text-[#6a6158] leading-relaxed mt-4 lg:text-lg">כל שקופית עם תמונה שלך, בצבעים ובגופנים שלך. לא אהבת ניסוח? כותבים לה במילים פשוטות מה לשנות, וחוזרים אחורה בלחיצה.</p>
          <p className="text-sm font-bold mt-6" style={{ color: ROSE }}>נסי להחליק את הקרוסלה</p>
        </Rise>
        <div className="mt-10 lg:mt-0 flex flex-col items-center">
          <div className="relative w-[280px] lg:w-[320px] aspect-[4/5]">
            {SLIDES.map((s, k) => {
              const off = k - i;
              if (off < -1 || off > 2) return null;
              return (
                <motion.div
                  key={k}
                  className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_30px_60px_-30px_rgba(60,10,10,0.7)] cursor-grab active:cursor-grabbing"
                  style={{ zIndex: 10 - Math.abs(off) }}
                  animate={{ x: off < 0 ? 340 : off * -18, scale: off < 0 ? 0.9 : 1 - off * 0.06, rotate: off < 0 ? 8 : off * -2.5, opacity: off < 0 ? 0 : 1 - off * 0.2 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  drag={off === 0 ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={(_, info) => { if (info.offset.x > 60) go(1); else if (info.offset.x < -60) go(-1); }}
                >
                  <SlideFace s={s} />
                </motion.div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-6">
            <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="שקופית קודמת" className="w-11 h-11 rounded-full border-2 font-bold disabled:opacity-30" style={{ borderColor: B, color: B }}>→</button>
            <div className="flex gap-1.5">{SLIDES.map((_, k) => <motion.span key={k} className="h-2 rounded-full" animate={{ width: k === i ? 22 : 8, background: k === i ? B : `${B}33` }} />)}</div>
            <button type="button" onClick={() => go(1)} disabled={i === SLIDES.length - 1} aria-label="שקופית הבאה" className="w-11 h-11 rounded-full border-2 font-bold disabled:opacity-30" style={{ borderColor: B, color: B }}>←</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 8. מה מקבלים

const YOU_GET = [
  [Palette, 'קרוסלות בעיצוב המותג שלך, עם תמונה שלך בכל שקופית'],
  [Wand2, 'רילס מהסרטונים שלך, עם כתוביות מונפשות בכמה סגנונות'],
  [MessageCircle, 'כיתובים ומשפטי פתיחה שנשמעים כמוך'],
  [RefreshCw, 'לא אהבת משהו? מבקשים שינוי במילים פשוטות, והיא מתקנת'],
  [Sparkles, 'היא לומדת ממה שבחרת וממה שעבד אצלך, ומשתפרת מכל שבוע'],
  [FolderUp, 'הכול נשאר אצלך: ב-Claude שלך ובדרייב שלך'],
];

function YouGet() {
  return (
    <section className="px-5 py-20 lg:py-28">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[1120px]">
        <Rise className="text-center">
          <Eyebrow>מה מקבלים</Eyebrow>
          <H2>כל מה שמנהלת סושיאל עושה, בלי לחכות לה</H2>
        </Rise>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {YOU_GET.map(([Icon, t], k) => (
            <Rise key={t} delay={k * 0.06}>
              <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="group h-full rounded-2xl bg-[#faf6f1] border border-[#e3d9cc] p-6 shadow-[0_18px_40px_-30px_rgba(60,10,10,0.5)]">
                <span className="inline-flex w-12 h-12 rounded-2xl items-center justify-center transition-colors group-hover:bg-[#5E1D1D] group-hover:text-[#faf6f1]" style={{ background: `${ROSE}26`, color: B }}><Icon className="w-6 h-6" /></span>
                <p className="text-[#2a2622] leading-relaxed mt-4 lg:text-lg">{t}</p>
              </motion.div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 9. הסיפור

function Story() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  return (
    <section ref={ref} className="relative overflow-hidden px-5 py-24 lg:py-32" style={{ background: B }}>
      <motion.div aria-hidden style={{ y }} className="absolute -top-10 -left-10 w-[340px] h-[340px] rounded-full blur-3xl opacity-30" >
        <div className="w-full h-full rounded-full" style={{ background: PINK }} />
      </motion.div>
      <div className="relative mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[820px] text-center">
        <Rise>
          <Eyebrow light>למה בניתי את זה</Eyebrow>
          <p className="font-heading text-4xl md:text-5xl lg:text-6xl text-[#faf6f1] leading-[1.15] mt-5" style={{ textWrap: 'balance' }}>
            בניתי אותה קודם כל{' '}
            <span className="relative inline-block">
              בשבילי.
              <Swoosh className="absolute -bottom-3 right-0 w-full h-4" color={PINK} delay={0.4} />
            </span>
          </p>
          <p className="text-[#f6efe6]/85 leading-relaxed mt-8 lg:text-lg max-w-[640px] mx-auto">
            אני הדראל, אמא צעירה עם הפרעת קשב, ובונה פתרונות דיגיטליים. נמאס לי לשבת כל ערב מול הטלפון ולחשוב מה להעלות לעמוד של Plania, אז בניתי לעצמי מנהלת סושיאל. היום היא מכינה לי את השבוע, ואני בוחרת ומפרסמת. עכשיו אני פותחת אותה לעוד כמה בעלות עסקים.
          </p>
        </Rise>
      </div>
    </section>
  );
}

// ---------- 10. מסלולים

function Tiers() {
  const reduce = useReducedMotion();
  return (
    <section className="px-5 py-20 lg:py-28">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[920px]">
        <Rise className="text-center">
          <Eyebrow>שני מסלולים</Eyebrow>
          <H2>לבד, או יחד איתי</H2>
        </Rise>
        <div className="mt-10 grid gap-5 md:grid-cols-2 items-stretch">
          <Rise>
            <motion.div whileHover={{ y: -6 }} className="h-full rounded-3xl border-2 p-7 bg-[#faf6f1]" style={{ borderColor: `${B}40` }}>
              <p className="font-heading text-3xl" style={{ color: B }}>עצמאית</p>
              <p className="text-[#6a6158] mt-1">מתקינה לבד, לפי הדרכה קצרה</p>
              <ul className="space-y-3 mt-6">
                {['כל הפלאגין', 'שאלון פתיחה שמכיר את העסק שלך', 'שבוע תוכן חדש כל שבוע'].map((t) => (
                  <li key={t} className="flex gap-3 items-center text-[#2a2622]"><Check className="w-4 h-4 shrink-0" style={{ color: ROSE }} />{t}</li>
                ))}
              </ul>
              <p className="font-heading text-2xl mt-8" style={{ color: B }}>בחינם לבודקות הראשונות</p>
            </motion.div>
          </Rise>
          <Rise delay={0.1}>
            <motion.div whileHover={{ y: -6 }} className="relative h-full rounded-3xl p-[2px] overflow-hidden">
              {/* מסגרת שמסתובבת לאט */}
              <motion.div
                aria-hidden
                className="absolute -inset-[60%]"
                style={{ background: `conic-gradient(from 0deg, ${PINK}, ${B}, ${ROSE}, ${B}, ${PINK})` }}
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative h-full rounded-[22px] p-7 text-[#faf6f1]" style={{ background: B }}>
                <span className="absolute top-5 left-5 text-[11px] font-bold rounded-full px-3 py-1" style={{ background: PINK, color: B }}>הכי נוח</span>
                <p className="font-heading text-3xl">התקנה אישית איתי</p>
                <p className="text-[#f6efe6]/80 mt-1">שיחה אחת, ויוצאות עם הכול מוכן</p>
                <ul className="space-y-3 mt-6">
                  {['מתקינות ומחברות יחד', 'ממלאות יחד את השאלון ומגדירות את המותג שלך', 'בונות יחד את השבוע הראשון'].map((t) => (
                    <li key={t} className="flex gap-3 items-center"><Check className="w-4 h-4 shrink-0" style={{ color: PINK }} />{t}</li>
                  ))}
                </ul>
                <p className="font-heading text-2xl mt-8">המחיר יפורסם בהשקה</p>
              </div>
            </motion.div>
          </Rise>
        </div>
      </div>
    </section>
  );
}

// ---------- 11. שאלות

const FAQ = [
  ['מה צריך כדי להשתמש?', 'חשבון Claude בתשלום (Pro ומעלה), חשבון גוגל עם דרייב, ואינסטגרם.'],
  ['היא מפרסמת לבד?', 'לא. את מאשרת כל פוסט ומפרסמת מהטלפון. ככה את גם מוסיפה מוזיקה טרנדית, מה שאי אפשר להוסיף מבחוץ.'],
  ['זה בעברית?', 'כן. השאלון, הכיתובים והכתוביות, הכול בעברית.'],
  ['אני צריכה להבין בטכנולוגיה?', 'לא. מתקינים בכמה לחיצות, ומדברים איתה כמו בצ׳אט רגיל.'],
  ['ומה עם הפרטיות שלי?', 'התמונות נשארות בדרייב שלך, והעבודה קורית ב-Claude שלך. אני לא רואה את התוכן שלך.'],
  ['מתי זה יוצא?', 'קודם קבוצה קטנה של בודקות. אחרי שהכול עובד חלק, ההשקה.'],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="px-5 py-20 lg:py-28 bg-[#faf6f1]">
      <div className="mx-auto w-full max-w-[460px] md:max-w-[720px] lg:max-w-[760px]">
        <Rise className="text-center">
          <Eyebrow>שאלות</Eyebrow>
          <H2>מה ששואלים אותי</H2>
        </Rise>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a], k) => (
            <Rise key={q} delay={k * 0.04}>
              <div className="rounded-2xl border bg-white/70 overflow-hidden transition-colors" style={{ borderColor: open === k ? `${B}66` : '#e3d9cc' }}>
                <button type="button" aria-expanded={open === k} onClick={() => setOpen(open === k ? -1 : k)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-right font-bold text-[#2a2622] lg:text-lg">
                  {q}
                  <motion.span animate={{ rotate: open === k ? 45 : 0 }} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xl" style={{ background: open === k ? B : `${ROSE}26`, color: open === k ? '#faf6f1' : B }}>+</motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open === k && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                      <p className="px-5 pb-5 text-[#6a6158] leading-relaxed">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- 12. הרשמה

function JoinForm() {
  const [form, setForm] = useState({ name: '', phone: '', instagram: '', business: '', plan: 'עצמאית' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const input = 'w-full bg-[#f2ece4] border border-[#e3d9cc] rounded-xl px-4 py-3.5 text-[#2a2622] placeholder:text-[#8a8079] focus:outline-none focus:border-[#5E1D1D] focus:bg-white transition-colors text-right';

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setFailed(false);
    setSending(true);
    const message = [`מסלול: ${form.plan}`, form.instagram && `אינסטגרם: ${form.instagram.trim()}`, form.business && `העסק: ${form.business.trim()}`].filter(Boolean).join(' | ');
    try {
      await base44.entities.Lead.create({
        name: form.name.trim(), phone: form.phone.trim(), message, service: 'social',
        status: 'ליד חדש', follow_up_date: todayISO(), ...getAttribution(),
      });
      setSent(true);
      try { await base44.functions.invoke('submitLead', { name: form.name, phone: form.phone, message, service: 'social' }); } catch { /* ההרשמה כבר נשמרה */ }
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-[#f2ece4] px-6 py-10 text-center">
        <svg viewBox="0 0 52 52" className="w-16 h-16 mx-auto" aria-hidden>
          <motion.circle cx="26" cy="26" r="24" fill="none" stroke={B} strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
          <motion.path d="M15 27 l7 7 l15 -16" fill="none" stroke={B} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.5 }} />
        </svg>
        <p className="font-heading text-3xl mt-4" style={{ color: B }}>נרשמת</p>
        <p className="text-[#2a2622] leading-relaxed mt-2">כשנפתח מקום בקבוצת הבודקות, אחזור אלייך בוואטסאפ עם כל הפרטים.</p>
      </motion.div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input required value={form.name} onChange={set('name')} placeholder="שם מלא *" className={input} autoComplete="name" />
        <input required type="tel" dir="rtl" value={form.phone} onChange={set('phone')} placeholder="טלפון *" className={input} autoComplete="tel" />
        <input value={form.instagram} onChange={set('instagram')} placeholder="שם העמוד באינסטגרם" className={input} dir="auto" />
        <input value={form.business} onChange={set('business')} placeholder="מה העסק שלך?" className={input} />
      </div>
      <fieldset className="pt-1">
        <legend className="text-sm font-bold mb-2" style={{ color: B }}>איך תרצי להתחיל?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {['עצמאית', 'עם התקנה אישית'].map((p) => (
            <label key={p} className="relative flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors" style={{ borderColor: form.plan === p ? B : '#e3d9cc', background: form.plan === p ? 'rgba(94,29,29,0.05)' : 'transparent' }}>
              <input type="radio" name="plan" value={p} checked={form.plan === p} onChange={set('plan')} className="accent-[#5E1D1D] w-4 h-4" />
              <span className="text-[#2a2622] font-medium">{p}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-[#6a6158] leading-relaxed">
        הפרטים ישמשו כדי לחזור אלייך בנוגע לפלאגין. בשליחת הטופס את מאשרת את{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">מדיניות הפרטיות</a>.
      </p>
      {failed && <FormErrorNotice color={B} />}
      <button type="submit" disabled={sending} className="group relative w-full overflow-hidden py-4 rounded-2xl font-bold text-[#faf6f1] transition disabled:opacity-60" style={{ background: B }}>
        <span aria-hidden className="absolute inset-y-0 -right-1/2 w-1/3 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover:right-[130%]" />
        <span className="relative">{sending ? 'שולחת...' : 'אני רוצה להיות מהראשונות'}</span>
      </button>
    </form>
  );
}

function Join() {
  return (
    <section id="join" className="scroll-mt-20 relative overflow-hidden px-5 py-20 lg:py-28">
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 50% at 50% 0%, ${PINK}55, transparent 70%)` }} />
      <div className="relative mx-auto w-full max-w-[460px] md:max-w-[640px]">
        <Rise className="text-center">
          <Eyebrow>הרשמה לבודקות</Eyebrow>
          <H2>רוצה להיות מהראשונות?</H2>
          <p className="text-[#6a6158] leading-relaxed mt-4 lg:text-lg">קבוצת הבודקות קטנה. משאירים פרטים, ואני חוזרת אלייך כשנפתח מקום.</p>
        </Rise>
        <Rise delay={0.1} className="mt-8 rounded-3xl bg-[#faf6f1] border border-[#e3d9cc] p-6 lg:p-8 shadow-[0_30px_60px_-36px_rgba(60,10,10,0.6)]">
          <JoinForm />
        </Rise>
      </div>
    </section>
  );
}

// כפתור הרשמה צף בטלפון: מופיע אחרי הפתיחה, ונעלם כשמגיעים לטופס
function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const join = document.getElementById('join');
      const nearJoin = join ? join.getBoundingClientRect().top < window.innerHeight * 0.9 : false;
      setShow(window.scrollY > 700 && !nearJoin);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href="#join"
          initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="lg:hidden fixed z-40 right-4 left-20 flex items-center justify-center h-12 rounded-2xl font-bold text-[#faf6f1] shadow-[0_14px_30px_-10px_rgba(94,29,29,0.8)]"
          style={{ background: B, bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          אני רוצה להיות מהראשונות
        </motion.a>
      )}
    </AnimatePresence>
  );
}

export default function Social() {
  return (
    <div className="overflow-x-hidden">
      <Hero />
      <Ticker />
      <BeforeAfter />
      <HowItWorks />
      <CaptionStyles />
      <ContentTypes />
      <SwipeCarousel />
      <YouGet />
      <Story />
      <Tiers />
      <Faq />
      <Join />
      <StickyCta />
    </div>
  );
}
