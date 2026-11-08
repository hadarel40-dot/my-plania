import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import useNoIndex from '@/hooks/useNoIndex';
import GoogleIcon from '@/components/GoogleIcon';

const inputClass =
  'w-full border border-[#d8cec1] bg-white px-4 py-3 text-sm text-[#2a2622] outline-none focus:border-[#5E1D1D]';

export default function AdminLogin() {
  useNoIndex();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.reload();
    } catch (err) {
      setError('אימייל או סיסמה שגויים');
      setSending(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider('google', '/hp-manage-7k2x');
  };

  return (
    <div className="min-h-screen bg-[#f0e8df] flex items-center justify-center px-5">
      <div className="w-full max-w-[380px]">
        <h1 className="font-heading text-2xl text-[#2a2622] text-center mb-6">כניסה</h1>
        <div className="bg-[#faf6f1] border border-[#e6dccd] p-6 mb-3">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 border border-[#d8cec1] bg-white py-3 text-sm font-bold text-[#2a2622]"
          >
            <GoogleIcon className="w-5 h-5" />
            התחברות עם Google
          </button>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#faf6f1] border border-[#e6dccd] p-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs text-[#6a6158] mb-1.5">
              אימייל
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-xs text-[#6a6158] mb-1.5">
              סיסמה
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              required
            />
          </div>

          {error && <p className="text-xs text-[#8a1f1f]">{error}</p>}

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-[#2a2622] text-white py-3 text-sm font-bold disabled:opacity-60"
          >
            {sending ? 'מתחברים...' : 'כניסה עם סיסמה'}
          </button>
          <Link
            to="/forgot-password"
            className="block text-center text-xs text-[#6a6158] underline"
          >
            שכחתי סיסמה / אין לי סיסמה
          </Link>
        </form>
      </div>
    </div>
  );
}