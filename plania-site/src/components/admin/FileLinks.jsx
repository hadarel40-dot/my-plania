import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, FileText, Loader2 } from 'lucide-react';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function signedUrlFor(file) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
    file_uri: file.uri,
    expires_in: 3600,
  });
  return signed_url;
}

// Saves the file straight to the device. If the browser blocks reading it, opens it instead.
async function saveFile(file) {
  const url = await signedUrlFor(file);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('fetch failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = file.name || 'file';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function FileLinks({ files }) {
  const list = Array.isArray(files) ? files : [];
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (!list.length) return null;

  const open = async (file) => {
    setError('');
    setBusy(`open-${file.uri}`);
    try {
      window.open(await signedUrlFor(file), '_blank', 'noopener,noreferrer');
    } catch {
      setError('לא הצלחתי לפתוח את הקובץ, נסו שוב');
    } finally {
      setBusy('');
    }
  };

  const download = async (file) => {
    setError('');
    setBusy(`dl-${file.uri}`);
    try {
      await saveFile(file);
    } catch {
      setError('לא הצלחתי להוריד את הקובץ, נסו שוב');
    } finally {
      setBusy('');
    }
  };

  const downloadEveryFile = async () => {
    setError('');
    setBusy('all');
    try {
      for (const file of list) {
        await saveFile(file);
        await wait(500);
      }
    } catch {
      setError('לא כל הקבצים ירדו, נסו שוב');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mb-3 bg-white border border-dashed border-[#e3d9cc] px-3 py-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-[#6a6158]">קבצים מצורפים ({list.length})</p>
        {list.length > 1 && (
          <button
            type="button"
            onClick={downloadEveryFile}
            disabled={busy === 'all'}
            className="flex items-center gap-1 text-xs font-bold text-[#5E1D1D] disabled:opacity-60"
          >
            {busy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {busy === 'all' ? 'מורידה...' : 'הורדת כולם'}
          </button>
        )}
      </div>
      <ul className="divide-y divide-[#efe7dc]">
        {list.map((file, index) => (
          <li key={`${file.uri}-${index}`} className="flex items-center gap-2 py-1.5">
            <button
              type="button"
              onClick={() => open(file)}
              disabled={busy === `open-${file.uri}`}
              className="flex items-center gap-2 text-sm text-[#2a2622] text-right min-w-0 flex-1 disabled:opacity-60"
            >
              {busy === `open-${file.uri}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 shrink-0 text-[#6a6158]" />
              )}
              <span className="truncate">{file.name}</span>
            </button>
            <button
              type="button"
              onClick={() => download(file)}
              disabled={busy === `dl-${file.uri}` || busy === 'all'}
              aria-label={`הורדת ${file.name}`}
              className="shrink-0 p-2 -m-1 text-[#5E1D1D] disabled:opacity-60"
            >
              {busy === `dl-${file.uri}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-[#a33] mt-2">{error}</p>}
    </div>
  );
}
