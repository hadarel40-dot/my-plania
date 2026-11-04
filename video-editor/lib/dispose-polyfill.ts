/**
 * ב-iPhone (Safari) אין Symbol.dispose. כל אחת מספריות הייצוא והכיווץ (Remotion, mediabunny)
 * משלימה אותו בעצמה, אבל כל אחת בסמל אחר, ולכן הייצוא נכשל ב-"Object not disposable".
 * כאן כולן מקבלות את אותו הסמל, לפני שהן נטענות. (יש עותק זהה בראש הדף, ב-app/layout.tsx)
 */
if (typeof Symbol.dispose !== "symbol") Object.defineProperty(Symbol, "dispose", { value: Symbol.for("Symbol.dispose"), configurable: true });
if (typeof Symbol.asyncDispose !== "symbol") Object.defineProperty(Symbol, "asyncDispose", { value: Symbol.for("Symbol.asyncDispose"), configurable: true });
export {};
