import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Paperclip, X } from 'lucide-react';

const MAX_FILES = 10;

export default function FilesField({ value, onChange, accent }) {
  const files = Array.isArray(value) ? value : [];
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    if (files.length + picked.length > MAX_FILES) {
      setError(`ניתן להעלות עד ${MAX_FILES} קבצים`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const uploaded = [];
      for (const file of picked) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uploaded.push({ name: file.name, uri: file_uri });
      }
      onChange([...files, ...uploaded]);
    } catch {
      setError('העלאת הקובץ נכשלה, נסו שוב');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFiles} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 border border-dashed px-4 py-3 text-sm disabled:opacity-60"
        style={{ borderColor: accent, color: accent }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        {busy ? 'מעלה קבצים...' : 'בחירת קבצים'}
      </button>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.uri}-${index}`}
              className="flex items-center justify-between gap-2 bg-[#f2ece4] border border-[#e3d9cc] px-3 py-2"
            >
              <span className="text-xs text-[#2a2622] truncate">{file.name}</span>
              <button
                type="button"
                aria-label="הסרת קובץ"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="text-[#8a8079] hover:text-[#5E1D1D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-[#a33] mt-2">{error}</p>}
    </div>
  );
}