"use client";

/**
 * לעבודה ארוכה בדפדפן (העלאה, ייצוא): מונע מהמסך להיכבות (בטלפון זה עוצר הכל),
 * ומבקש אישור לפני יציאה מהעמוד. מחזיר פונקציה שמשחררת את שניהם.
 * לא מחכים לבקשת הנעילה: אם הדפדפן מתעכב או מסרב, העבודה מתחילה בכל מקרה.
 */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let released = false;
  const acquire = async () => {
    try {
      const l = await navigator.wakeLock?.request("screen");
      if (released) void l?.release(); else lock = l ?? null;
    } catch { /* לא נתמך או נדחה */ }
  };
  // הנעילה משתחררת כשהלשונית מוסתרת, ולכן מבקשים אותה שוב כשחוזרים
  const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
  const warnOnLeave = (e: BeforeUnloadEvent) => e.preventDefault();
  void acquire();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("beforeunload", warnOnLeave);
  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("beforeunload", warnOnLeave);
    void lock?.release().catch(() => undefined);
  };
}
