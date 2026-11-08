import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { formatDateOnly } from '@/lib/formatDate';

const number = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('he-IL'));

function Stat({ label, value, hint, suffix = '' }) {
  return (
    <div className="bg-white border border-[#e3d9cc] px-3 py-2.5">
      <p className="text-[11px] text-[#6a6158]">{label}</p>
      <p className="font-heading text-2xl text-[#5E1D1D]">
        {number(value)}
        {suffix}
      </p>
      {hint && <p className="text-[10px] text-[#8a8079]">{hint}</p>}
    </div>
  );
}

function FollowersLine({ history }) {
  if (!history || history.length < 2) {
    return (
      <p className="text-xs text-[#6a6158]">
        גרף העוקבים יתחיל להתמלא מהיום. כל יום שבו נכנסים למסך הזה נשמרת נקודה חדשה.
      </p>
    );
  }
  const values = history.map((point) => Number(point.followers || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 300;
  const height = 70;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 8 - ((value - min) / span) * (height - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const change = values[values.length - 1] - values[0];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[11px] text-[#6a6158]">עוקבים לאורך זמן</p>
        <p className={`text-xs font-bold ${change >= 0 ? 'text-[#4A6355]' : 'text-[#c0392b]'}`}>
          {change >= 0 ? '+' : ''}
          {change} מאז {formatDateOnly(history[0].date)}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[70px]" preserveAspectRatio="none" role="img" aria-label="גרף עוקבים">
        <polyline fill="none" stroke="#5E1D1D" strokeWidth="2" points={points} />
      </svg>
    </div>
  );
}

// The account itself: followers over time, how the recent posts perform and the latest posts.
export default function InstagramAccount() {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const response = await base44.functions.invoke('instagramStats', {});
      setState({ status: 'ok', data: response?.data, error: '' });
    } catch (error) {
      const message = error?.response?.data?.error || 'לא הצלחתי לטעון את נתוני האינסטגרם';
      setState({ status: message.includes('לא מחובר') ? 'off' : 'error', data: null, error: message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status, data, error } = state;

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-heading text-lg text-[#2a2622]">החשבון באינסטגרם</h2>
        <button
          type="button"
          onClick={load}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 text-xs font-bold text-[#5E1D1D] disabled:opacity-60"
        >
          {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          רענון
        </button>
      </div>

      {status === 'loading' && !data && <p className="text-sm text-[#6a6158]">טוענת נתונים...</p>}

      {status === 'off' && (
        <p className="text-sm text-[#6a6158] leading-relaxed">
          החשבון עוד לא מחובר לאפליקציה. אחרי החיבור יופיעו כאן עוקבים, מעורבות והפוסטים האחרונים.
        </p>
      )}

      {status === 'error' && <p className="text-sm text-[#a33] leading-relaxed">{error}</p>}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {data.profile?.profile_picture_url && (
              <img src={data.profile.profile_picture_url} alt="" className="w-12 h-12 object-cover" />
            )}
            <div>
              <p className="font-bold text-[#2a2622]">@{data.profile?.username}</p>
              <p className="text-xs text-[#6a6158]">
                {number(data.profile?.followers_count)} עוקבים · {number(data.profile?.media_count)} פוסטים
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="לייקים"
              value={data.engagement?.likes}
              hint={`ב־${number(data.engagement?.posts)} הפוסטים האחרונים`}
            />
            <Stat label="תגובות" value={data.engagement?.comments} hint="באותם פוסטים" />
            <Stat
              label="ממוצע לפוסט"
              value={data.engagement?.avg_likes}
              hint={`${number(data.engagement?.avg_comments)} תגובות בממוצע`}
            />
            <Stat
              label="מעורבות"
              value={data.engagement?.rate}
              suffix="%"
              hint="מהעוקבים, בממוצע לפוסט"
            />
          </div>

          <FollowersLine history={data.history} />

          {Array.isArray(data.media) && data.media.length > 0 && (
            <div>
              <p className="text-[11px] text-[#6a6158] mb-2">הפוסטים האחרונים, מהכי מגיב</p>
              <ul className="space-y-2">
                {[...data.media]
                  .sort(
                    (a, b) =>
                      Number(b.like_count || 0) + Number(b.comments_count || 0) -
                      (Number(a.like_count || 0) + Number(a.comments_count || 0))
                  )
                  .slice(0, 6)
                  .map((post) => (
                    <li key={post.id}>
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-white border border-[#e3d9cc] px-2 py-2 hover:border-[#5E1D1D]"
                      >
                        {(post.thumbnail_url || post.media_url) && (
                          <img src={post.thumbnail_url || post.media_url} alt="" className="w-12 h-12 object-cover shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-[#2a2622] truncate">
                            {post.caption ? post.caption.split('\n')[0] : 'ללא כיתוב'}
                          </span>
                          <span className="flex items-center gap-3 text-[11px] text-[#6a6158] mt-0.5">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {number(post.like_count)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {number(post.comments_count)}
                            </span>
                            <span>{formatDateOnly(String(post.timestamp).slice(0, 10))}</span>
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}