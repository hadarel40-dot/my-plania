import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

const KEY = "scroll-positions";

const readPositions = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

const writePosition = (locKey, y) => {
  try {
    const all = readPositions();
    all[locKey] = y;
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
};

export default function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();

  // השחזור של מיקום הגלילה נעשה כאן ולא בדפדפן, כי הדפים נטענים עם אנימציה והדפדפן מפספס
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // שומרים את המיקום הנוכחי של הדף כל עוד גוללים בו
  useEffect(() => {
    let frame = 0;
    const save = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => writePosition(key, window.scrollY));
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      window.cancelAnimationFrame(frame);
    };
  }, [key]);

  useEffect(() => {
    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    const saved = navigationType === "POP" ? readPositions()[key] : undefined;
    const target = typeof saved === "number" ? saved : 0;

    const root = document.documentElement;
    const go = () => {
      window.scrollTo(0, target);
      if (target === 0) {
        root.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };
    // משהים את ההצמדה בזמן המעבר, כדי שהדף החדש לא ייתפס באמצע
    root.classList.add("no-snap");
    go();
    const frame = window.requestAnimationFrame(go);
    const t1 = window.setTimeout(go, 80);
    const t2 = window.setTimeout(go, 300);
    const t3 = window.setTimeout(() => root.classList.remove("no-snap"), 500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      root.classList.remove("no-snap");
    };
  }, [pathname, hash, key, navigationType]);

  return null;
}
