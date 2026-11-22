"use client";
import { useEffect, useState } from "react";
import { FONTS, PHOTO_DEFAULT, type BrandKit, type Theme } from "@/lib/studio/brand";
import type { Account } from "@/lib/studio/config";
import { db } from "@/lib/studio/client";
import { Btn, Label, toast } from "./ui";
import { cn } from "@/lib/utils";

/** ערכת המותג של חשבון (נשמרת בפרופיל הקול) */
export function useBrand(account: Account) {
  const [brand, setBrand] = useState<BrandKit | null>(null);
  useEffect(() => {
    db().from("studio_voice").select("profile").eq("account", account).maybeSingle().then(({ data }) => setBrand(((data?.profile as { brand?: BrandKit } | undefined)?.brand) ?? {}));
  }, [account]);
  const save = async (next: BrandKit) => {
    const { data } = await db().from("studio_voice").select("profile").eq("account", account).maybeSingle();
    const profile = { ...((data?.profile as Record<string, unknown>) ?? {}), brand: next };
    const { error } = await db().from("studio_voice").upsert({ account, profile });
    if (error) return toast(error.message, true);
    setBrand(next);
    toast("ערכת המותג נשמרה");
  };
  return { brand, save };
}

function ColorField({ label, value, onChange, palette }: { label: string; value: string; onChange: (v: string) => void; palette: string[] }) {
  return (
    <div>
      <Label className="mb-1">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-md border border-[#E3D9CC] bg-white p-0.5" aria-label={label} />
        <input value={value} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)} className="w-[86px] rounded-md border border-[#E3D9CC] bg-white/70 px-2 py-1 font-mono text-[12px]" dir="ltr" />
        {palette.map((p) => (
          <button key={p} type="button" title={p} onClick={() => onChange(p)} className={cn("size-6 rounded-full border", value.toLowerCase() === p.toLowerCase() ? "border-[#5E1D1D] ring-2 ring-[#5E1D1D]/30" : "border-[#E3D9CC]")} style={{ background: p }} />
        ))}
      </div>
    </div>
  );
}

function FontField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="mb-1">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#DDD4C6] bg-white/70 px-2 py-1.5 text-[15px]" style={{ fontFamily: `"${value}"` }}>
        {FONTS.map((f) => <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>{f.label}</option>)}
      </select>
      <p className="mt-1 truncate text-[18px] leading-tight" style={{ fontFamily: `"${value}"`, fontWeight: 700 }}>תכנון שבוע בלי לשבור את הראש</p>
    </div>
  );
}

function Range({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <Label className="mb-1">{label} · {fmt(value)}</Label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#5E1D1D]" />
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div>
      <Label className="mb-1">{label}</Label>
      <div className="flex gap-1">
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)} className={cn("rounded-lg border px-2.5 py-1 text-[12px] font-semibold", value === v ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-white/70")}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/**
 * עריכת עיצוב רחבה לקרוסלה: פונטים, צבעים, גודל, החשכה, יישור ומיקום.
 * הפלטה של המותג מופיעה ליד כל צבע. "להחיל את המותג" ממלא הכול מערכת המותג, ו"לשמור כמותג" שומר את העיצוב הנוכחי.
 */
export function DesignPanel({ account, theme, onChange, brandMode = false }: { account: Account; theme: Theme | undefined; onChange: (t: Theme) => void; brandMode?: boolean }) {
  const { brand, save } = useBrand(account);
  const t = { ...PHOTO_DEFAULT, ...(theme ?? {}) };
  const palette = brand?.palette?.length ? brand.palette : ["#F7C9D6", "#FFFFFF", "#2A2622", "#F6E7A6", "#3E6B4F"];
  const set = (patch: Theme) => onChange({ ...(theme ?? {}), ...patch });
  const [newColor, setNewColor] = useState("#F7C9D6");
  const applyBrand = () => {
    if (!brand) return;
    const { palette: _p, cta: _c, hashtags: _h, ...rest } = brand; // eslint-disable-line @typescript-eslint/no-unused-vars
    onChange({ ...(theme ?? {}), ...rest });
    toast("הוחל עיצוב המותג");
  };

  return (
    <div className="space-y-4 rounded-xl bg-[#F2ECE4] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">{brandMode ? "ערכת המותג" : "עיצוב"}</span>
        {!brandMode && <div className="flex flex-wrap gap-1.5">
          <Btn variant="line" disabled={!brand || !Object.keys(brand).length} onClick={applyBrand}>להחיל את המותג</Btn>
          <Btn variant="ghost" onClick={() => save({ ...(brand ?? {}), ...t, palette })}>לשמור כמותג</Btn>
          <Btn variant="ghost" onClick={() => onChange({})}>לאפס</Btn>
        </div>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FontField label="פונט כותרת" value={t.headFont} onChange={(v) => set({ headFont: v })} />
        <FontField label="פונט טקסט" value={t.bodyFont} onChange={(v) => set({ bodyFont: v })} />
        <ColorField label="צבע כותרת" value={t.headColor} onChange={(v) => set({ headColor: v })} palette={palette} />
        <ColorField label="צבע טקסט" value={t.bodyColor} onChange={(v) => set({ bodyColor: v })} palette={palette} />
        <ColorField label="רקע (שקופית בלי תמונה)" value={t.bg} onChange={(v) => set({ bg: v })} palette={palette} />
        <ColorField label="צבע הדגשה" value={t.accent} onChange={(v) => set({ accent: v })} palette={palette} />
        <Range label="גודל כותרת" value={t.headScale} min={0.7} max={1.4} step={0.05} onChange={(v) => set({ headScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Range label="גודל טקסט" value={t.bodyScale} min={0.7} max={1.4} step={0.05} onChange={(v) => set({ bodyScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Range label="החשכת התמונה" value={t.overlay} min={0} max={0.8} step={0.05} onChange={(v) => set({ overlay: v })} fmt={(v) => (v === 0 ? "בלי" : `${Math.round(v * 100)}%`)} />
        <div className="flex flex-wrap gap-4">
          <Choice label="יישור" value={t.align} options={[["right", "לימין"], ["center", "למרכז"]] as const} onChange={(v) => set({ align: v })} />
          <Choice label="מיקום הטקסט" value={t.position} options={[["top", "למעלה"], ["center", "באמצע"], ["bottom", "למטה"]] as const} onChange={(v) => set({ position: v })} />
        </div>
      </div>
      <div>
        <Label className="mb-1">צבעי המותג</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {palette.map((p) => (
            <span key={p} className="group relative">
              <span className="block size-7 rounded-full border border-[#E3D9CC]" style={{ background: p }} title={p} />
              {brand?.palette?.length ? <button type="button" aria-label="להסיר" onClick={() => save({ ...brand, palette: palette.filter((x) => x !== p) })} className="absolute -left-1 -top-1 hidden size-4 rounded-full bg-[#5E1D1D] text-[10px] leading-4 text-white group-hover:block">×</button> : null}
            </span>
          ))}
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded-md border border-[#E3D9CC] bg-white p-0.5" aria-label="צבע חדש" />
          <Btn variant="ghost" onClick={() => !palette.includes(newColor) && save({ ...(brand ?? {}), palette: [...palette, newColor].slice(0, 10) })}>להוסיף לפלטה</Btn>
        </div>
        <p className="mt-1 text-[11px] text-[#6A6158]">הפלטה והפונטים נשמרים לחשבון, ומופיעים בכל קרוסלה. "לשמור כמותג" שומר את כל העיצוב הנוכחי כברירת המחדל.</p>
      </div>
    </div>
  );
}

/** ערכת המותג של חשבון, לעריכה במקום אחד (עמוד "הקול שלי"). כל קרוסלה יכולה להחיל אותה */
export function BrandKitEditor({ account }: { account: Account }) {
  const { brand, save } = useBrand(account);
  const [draft, setDraft] = useState<BrandKit | null>(null);
  useEffect(() => { setDraft(brand); }, [brand]);
  if (!draft) return null;
  const { palette: _p, cta: _c, hashtags: _h, ...theme } = draft; // eslint-disable-line @typescript-eslint/no-unused-vars
  return (
    <div className="space-y-2">
      <DesignPanel brandMode account={account} theme={theme} onChange={(t) => setDraft({ ...draft, ...t, palette: draft.palette })} />
      <div className="grid gap-3 rounded-xl bg-[#F2ECE4] p-3 md:grid-cols-2">
        <div>
          <Label className="mb-1">קריאה לפעולה קבועה (בסוף כל כיתוב)</Label>
          <input className="w-full rounded-lg border border-[#DDD4C6] bg-white/70 px-3 py-2 text-sm" value={draft.cta ?? ""} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} placeholder="למשל: הקישור בביו, 5 הדקות הראשונות בחינם" />
        </div>
        <div>
          <Label className="mb-1">תגיות קבועות</Label>
          <input className="w-full rounded-lg border border-[#DDD4C6] bg-white/70 px-3 py-2 text-sm" dir="auto" value={draft.hashtags ?? ""} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} placeholder="#Plania #תכנוןארוחות #מהמבשליםהיום" />
        </div>
        <p className="text-[11px] text-[#6A6158] md:col-span-2">כל קרוסלה חדשה מקבלת אוטומטית את העיצוב, הקריאה לפעולה והתגיות של החשבון. בקרוסלה קיימת: "פונטים וצבעים" ואז "להחיל את המותג".</p>
      </div>
      <Btn onClick={() => save({ ...draft, palette: brand?.palette ?? draft.palette })}>לשמור את ערכת המותג</Btn>
    </div>
  );
}
