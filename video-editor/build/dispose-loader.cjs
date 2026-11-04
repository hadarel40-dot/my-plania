/**
 * ב-iPhone (Safari) אין Symbol.dispose, וכל ספרייה של מנוע הייצוא (Remotion, mediabunny)
 * משלימה אותו בסמל אחר ("dispose" / "Symbol.dispose" / סמל חדש לגמרי). אז אובייקט שספרייה
 * אחת יצרה נראה "לא ניתן לשחרור" לספרייה אחרת, והייצוא נכשל ב-"Object not disposable".
 * ה-loader הזה משנה את הקוד בזמן הבנייה (בלי לגעת בקבצים המקוריים) כך שכולן ישתמשו באותו
 * סמל גלובלי, לא משנה מי נטענת קודם.
 */
const RULES = [
  [/Symbol\.for\((["'])dispose\1\)/g, 'Symbol.for("Symbol.dispose")'],
  [/Symbol\.for\((["'])asyncDispose\1\)/g, 'Symbol.for("Symbol.asyncDispose")'],
  [/\bSymbol\((["'])Symbol\.dispose\1\)/g, 'Symbol.for("Symbol.dispose")'],
  [/\bSymbol\((["'])Symbol\.asyncDispose\1\)/g, 'Symbol.for("Symbol.asyncDispose")'],
];

module.exports = function disposeLoader(source) {
  let out = source;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
};
module.exports.RULES = RULES;
