import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * מריץ אחרי שהמסך הספיק להתעדכן: הכפתור נדלק מיד, והעבודה הכבדה (בניית הסרטון מחדש)
 * באה רגע אחרי. כך כל לחיצה מרגישה מיידית גם בטלפון.
 */
export const afterPaint = (fn: () => void) => {
  if (typeof requestAnimationFrame === "undefined") return fn();
  requestAnimationFrame(() => setTimeout(fn, 0));
};
