// ============================================================
//  All the site content lives here. Change texts, colours, prices
//  and photos only in this file, nothing else needs touching.
//  The content below is a SAMPLE (placeholder business).
// ============================================================

export const site = {
  name: 'סטודיו נוף',
  // Logo: put a file in public/images and write its path, e.g. 'images/logo.png'. Empty = the name in text.
  logo: '',
  tagline: 'בתים שמרגישים כמו מי שגר בהם.',
  subline: 'עיצוב פנים, תכנון וסטיילינג.',
  whatsapp: '972500000000', // international format, no + and no leading 0
  whatsappHello: 'היי, הגעתי מהאתר ויש לי שאלה',
  instagram: 'https://www.instagram.com/',
  email: 'hello@example.com',
  // Main brand colour (titles, buttons, top border) and page background
  brand: '#5E1D1D',
  accent: '#B5848E',
  background: '#f0e8df',
};

// Every service gets a banner on the home page and its own page.
// image: a path in public/images (e.g. 'images/living.jpg'). Empty = a background in the brand colour.
export const services = [
  {
    key: 'design',
    path: '/design',
    label: 'עיצוב פנים',
    color: '#5E1D1D',
    image: '',
    card: {
      title: 'עיצוב פנים מלא',
      subtitle: 'מהקיר הריק ועד הכרית האחרונה',
      text: 'תכנון החלל, בחירת חומרים, ריהוט ותאורה, וליווי מול בעלי המקצוע עד שהבית מוכן.',
      button: 'לכל הפרטים',
    },
    hero: {
      eyebrow: 'עיצוב פנים',
      titleLines: [
        { size: 'sm', parts: [{ t: 'לא עוד ' }, { t: 'שיפוץ', strike: true }, { t: '.' }] },
        { size: 'md', parts: [{ t: 'בית' }] },
        { size: 'xl', parts: [{ t: 'שמרגיש', mark: true }] },
        { size: 'md', parts: [{ t: 'כמו שלכם.' }] },
      ],
      title: 'לא עוד שיפוץ. בית שמרגיש כמו שלכם.',
      subtitle: 'תכנון ועיצוב שמתחילים מאיך שאתם חיים',
      text: 'אנחנו מתחילים בשיחה על השגרה שלכם, ורק אחר כך מגיעים לצבעים ולחומרים. התוצאה היא בית שנוח לחיות בו, לא רק יפה בתמונות.',
    },
    forYou: [
      'קניתם דירה ולא יודעים מאיפה להתחיל',
      'נמאס לכם מהבית אבל לא רוצים לעבור',
      'רוצים תוצאה מקצועית בלי לרדוף אחרי עשרה בעלי מקצוע',
      'התחלתם לבד ונתקעתם באמצע',
    ],
    youGet: [
      'פגישת היכרות ומדידות בבית',
      'תוכנית העמדה ושתי חלופות עיצוב',
      'הדמיות לפני שמזמינים משהו',
      'רשימת קניות מסודרת עם קישורים',
      'ליווי בשטח עד הסוף',
    ],
    steps: [
      'שיחת היכרות: מה אתם צריכים ומה התקציב',
      'תכנון והדמיות',
      'ביצוע, עם עדכונים לאורך הדרך',
      'סטיילינג ומסירה',
    ],
    price: {
      lead: 'תכנון מלא לדירה, החל מ־',
      value: '4,900',
      under: 'המחיר הסופי לפי גודל הדירה',
      button: 'לתיאום שיחת היכרות',
      whatsapp: 'היי, אשמח לשמוע על עיצוב פנים מלא',
    },
  },
  {
    key: 'consult',
    path: '/consult',
    label: 'ייעוץ',
    color: '#4A6355',
    image: '',
    card: {
      title: 'ייעוץ חד־פעמי',
      subtitle: 'שלוש שעות שעושות סדר',
      text: 'מגיעה אליכם, עוברים יחד על הבית, ויוצאים עם רשימה ברורה של מה לשנות ובאיזה סדר.',
      button: 'לכל הפרטים',
    },
    hero: {
      eyebrow: 'ייעוץ בבית',
      title: 'שלוש שעות. בית אחר.',
      subtitle: 'ייעוץ ממוקד למי שרוצה לעשות לבד, אבל נכון',
      text: 'מתאים למי שאוהב לבחור לבד ורק צריך עין מקצועית שתכוון. אחרי הפגישה תקבלו סיכום כתוב עם המלצות, מידות וקישורים.',
    },
    forYou: [
      'רוצים לרענן את הבית בלי פרויקט גדול',
      'לא בטוחים איזה צבע, איזו ספה, איזו מנורה',
      'אוהבים לעשות לבד, רק צריכים כיוון',
    ],
    youGet: [
      'פגישה של שלוש שעות בבית',
      'סיכום כתוב תוך שלושה ימים',
      'רשימת מוצרים עם קישורים',
      'שבוע של שאלות בוואטסאפ',
    ],
    steps: ['קובעים מועד', 'נפגשים בבית', 'מקבלים סיכום והמלצות'],
    price: {
      lead: 'פגישת ייעוץ בבית',
      value: '850',
      under: 'כולל סיכום כתוב',
      button: 'לתיאום ייעוץ',
      whatsapp: 'היי, אשמח לתאם פגישת ייעוץ',
    },
  },
  {
    key: 'styling',
    path: '/styling',
    label: 'סטיילינג',
    color: '#8A5A3C',
    image: '',
    card: {
      title: 'הום סטיילינג',
      subtitle: 'הבית שלכם, בגרסה המוקפדת',
      text: 'טקסטיל, צמחים, אקססוריז ותמונות. בלי שיפוץ, רק עם מה שעושה את ההבדל.',
      button: 'לכל הפרטים',
    },
    hero: {
      eyebrow: 'הום סטיילינג',
      title: 'אותו בית. מרגיש חדש.',
      subtitle: 'שינוי גדול בלי פטישים ובלי אבק',
      text: 'אני מגיעה עם הכול: בוחרת, קונה, מסדרת ותולה. אתם חוזרים הביתה לבית מוכן.',
    },
    forYou: [
      'הבית גמור אבל מרגיש ריק',
      'עומדים למכור או להשכיר ורוצים שהבית יצטלם טוב',
      'אין לכם זמן לרוץ בין חנויות',
    ],
    youGet: [
      'בחירת פריטים לפי תקציב שתקבעו',
      'קנייה והובלה',
      'יום סידור ותלייה',
      'צילום לפני ואחרי',
    ],
    steps: ['שיחה ותקציב', 'בחירה וקנייה', 'יום סטיילינג בבית'],
    price: {
      lead: 'יום סטיילינג, החל מ־',
      value: '1,600',
      under: 'לא כולל עלות הפריטים',
      button: 'לפרטים בוואטסאפ',
      whatsapp: 'היי, אשמח לשמוע על הום סטיילינג',
    },
  },
];

export const waLink = (message) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
