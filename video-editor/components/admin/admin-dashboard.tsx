"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, Copy, Link2, Loader2, Share2, ShieldCheck, UserCheck, UserX, Users, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

interface JoinLink { token: string; created_at: string; revoked_at: string | null }
interface JoinRequest { id: string; email: string; status: "pending" | "approved" | "rejected" | "removed"; created_at: string; decided_at: string | null }

const date = (s: string) => new Date(s).toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });

export function AdminDashboard({ email, links, requests }: { email: string; links: JoinLink[]; requests: JoinRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const pending = requests.filter((r) => r.status === "pending");
  const members = requests.filter((r) => r.status === "approved" || r.status === "removed");
  // הכתובת המלאה נקבעת רק בדפדפן (בשרת אין location), כדי שהעמוד ייראה זהה בשניהם
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setOrigin(location.origin); setCanShare("share" in navigator); }, []);
  const url = (token: string) => `${origin}/invite/${token}`;

  async function act(id: string, action: "approve" | "reject" | "remove" | "restore") {
    if ((action === "reject" || action === "remove") && !confirm(action === "reject" ? "לדחות את הבקשה? החשבון יימחק." : "להשהות את המשתמשת? היא לא תוכל להיכנס עד שתחזירו אותה.")) return;
    setBusy(id + action);
    await getSupabaseBrowser().rpc("decide_join", { p_request: id, p_action: action });
    setBusy(null);
    router.refresh();
  }

  async function newLink() {
    setBusy("link");
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("invites").insert({ token, created_by: user?.id });
    setBusy(null);
    router.refresh();
  }

  async function revoke(token: string) {
    if (!confirm("לבטל את הקישור? מי שיפתח אותו לא יוכל לבקש להצטרף.")) return;
    setBusy(token);
    await getSupabaseBrowser().from("invites").update({ revoked_at: new Date().toISOString() }).eq("token", token);
    setBusy(null);
    router.refresh();
  }

  const copy = (token: string) => { void navigator.clipboard.writeText(url(token)); setCopied(token); setTimeout(() => setCopied(null), 1500); };
  const share = (token: string) => navigator.share?.({ text: `הזמנה לעורך הווידאו 🎬 פותחים את הקישור, בוחרים מייל וסיסמה, ואני מאשרת:\n${url(token)}` }).catch(() => undefined);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex items-center gap-1 rounded-md px-1 py-1 text-zinc-400 hover:text-white" title="לפרויקטים">
          <ChevronRight className="size-4" />
        </Link>
        <ShieldCheck className="size-5 text-violet-400" />
        <h1 className="text-sm font-semibold">ניהול העורך</h1>
        <span dir="ltr" className="ms-auto hidden text-xs text-zinc-500 sm:inline">{email}</span>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Clock className="size-4" />} label="ממתינות" value={pending.length} highlight={pending.length > 0} />
          <Stat icon={<Users className="size-4" />} label="משתמשות" value={members.filter((m) => m.status === "approved").length + 1} />
          <Stat icon={<Link2 className="size-4" />} label="קישורים פעילים" value={links.length} />
        </div>

        <Card title="בקשות להצטרפות" icon={<Clock className="size-4 text-amber-300" />}>
          {!pending.length && <p className="text-sm text-zinc-500">אין בקשות חדשות. כשמישהי תבקש להצטרף דרך הקישור, היא תופיע כאן.</p>}
          <div className="divide-y divide-zinc-800">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className="truncate text-start text-sm font-medium">{r.email}</p>
                  <p className="text-[11px] text-zinc-500">ביקשה להצטרף ב-{date(r.created_at)}</p>
                </div>
                <button onClick={() => act(r.id, "approve")} disabled={!!busy}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                  {busy === r.id + "approve" ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />} אישור
                </button>
                <button onClick={() => act(r.id, "reject")} disabled={!!busy}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-400 disabled:opacity-50">
                  <X className="size-4" /> דחייה
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="קישור הצטרפות" icon={<Link2 className="size-4 text-violet-300" />}
          action={<button onClick={newLink} disabled={!!busy} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium hover:bg-violet-500 disabled:opacity-50">
            {busy === "link" ? <Loader2 className="size-3.5 animate-spin" /> : "+ קישור חדש"}
          </button>}>
          <p className="mb-3 text-xs leading-relaxed text-zinc-400">
            אפשר לשתף את הקישור עם כמה אנשים שרוצים. כל מי שפותחת אותו שולחת בקשה, ונכנסת רק אחרי שמאשרים אותה כאן.
          </p>
          {!links.length && <p className="text-sm text-zinc-500">עוד אין קישור. לוחצים על &quot;קישור חדש&quot;.</p>}
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.token} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p dir="ltr" className="truncate text-xs text-zinc-300">{url(l.token)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {canShare && (
                    <button onClick={() => share(l.token)} className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium"><Share2 className="size-3.5" /> שליחה</button>
                  )}
                  <button onClick={() => copy(l.token)} className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs">
                    {copied === l.token ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied === l.token ? "הועתק" : "העתקה"}
                  </button>
                  <span className="text-[11px] text-zinc-500">נוצר ב-{date(l.created_at)}</span>
                  <button onClick={() => revoke(l.token)} className="ms-auto text-[11px] text-zinc-500 underline hover:text-red-300">ביטול הקישור</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="משתמשות" icon={<Users className="size-4 text-sky-300" />}>
          <div className="divide-y divide-zinc-800">
            <div className="flex items-center gap-3 py-3">
              <p dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm">{email}</p>
              <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-300">מנהלת</span>
            </div>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className={cn("truncate text-start text-sm", m.status === "removed" && "text-zinc-500 line-through")}>{m.email}</p>
                  <p className="text-[11px] text-zinc-500">{m.status === "removed" ? "מושהית" : `אושרה ב-${date(m.decided_at ?? m.created_at)}`}</p>
                </div>
                {m.status === "approved" ? (
                  <button onClick={() => act(m.id, "remove")} disabled={!!busy} className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-red-400 hover:text-red-300">
                    <UserX className="size-3.5" /> השהיה
                  </button>
                ) : (
                  <button onClick={() => act(m.id, "restore")} disabled={!!busy} className="flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-400">
                    <UserCheck className="size-3.5" /> החזרה
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-3", highlight ? "border-amber-400/40 bg-amber-400/10" : "border-zinc-800 bg-zinc-900/60")}>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}<h2 className="text-sm font-semibold">{title}</h2>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
