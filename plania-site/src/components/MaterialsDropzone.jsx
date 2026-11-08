import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertCircle,
  Check,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';

const MAX_FILES = 20;

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(file) {
  const type = file.type || '';
  const name = (file.name || '').toLowerCase();
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  if (type.startsWith('text/') || /\.(pdf|docx?|xlsx?|pptx?|txt|rtf|csv)$/.test(name)) return FileText;
  return FileIcon;
}

// Any file type is accepted. Files upload as soon as they are picked, with a
// status per file, and the parent receives only the finished uploads.
export default function MaterialsDropzone({ onChange, onBusyChange, accent = '#5E1D1D', resetKey }) {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const itemsRef = useRef([]);

  useEffect(() => {
    itemsRef.current = items;
    onChange(items.filter((item) => item.status === 'done').map(({ name, uri }) => ({ name, uri })));
    onBusyChange?.(items.some((item) => item.status === 'uploading'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    itemsRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    setItems([]);
    setError('');
  }, [resetKey]);

  const patch = (id, changes) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const addFiles = useCallback(async (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    if (itemsRef.current.length + picked.length > MAX_FILES) {
      setError(`אפשר לשלוח עד ${MAX_FILES} קבצים בכל פעם. אחרי השליחה אפשר להעלות עוד.`);
      return;
    }
    setError('');

    const created = picked.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type?.startsWith('image/') ? URL.createObjectURL(file) : '',
      status: 'uploading',
      uri: '',
    }));
    setItems((prev) => [...prev, ...created]);

    await Promise.all(
      created.map(async (item) => {
        try {
          const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: item.file });
          patch(item.id, { status: 'done', uri: file_uri });
        } catch {
          patch(item.id, { status: 'error' });
        }
      })
    );
  }, []);

  const remove = (id) =>
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className="w-full flex flex-col items-center justify-center gap-2 px-6 py-9 text-center transition-colors"
        style={{
          border: `1.5px dashed ${dragging ? accent : '#cdbfae'}`,
          background: dragging ? '#f3e7e1' : '#fffdfa',
          borderRadius: 10,
        }}
      >
        <span
          className="flex items-center justify-center w-12 h-12"
          style={{ background: '#f3e7e1', color: accent, borderRadius: 10 }}
        >
          <UploadCloud className="w-6 h-6" strokeWidth={1.6} />
        </span>
        <span className="font-heading text-lg text-[#2a2622]">גררו לכאן קבצים או לחצו לבחירה</span>
        <span className="text-xs text-[#6a6158]">
          כל סוג קובץ: תמונות, מסמכים, סרטונים, לוגו, קבצי עיצוב ועוד
        </span>
      </button>

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const Icon = iconFor(item);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 bg-white border border-[#e3d9cc] px-3 py-2"
                style={{ borderRadius: 8 }}
              >
                {item.preview ? (
                  <img src={item.preview} alt="" className="w-10 h-10 object-cover shrink-0" style={{ borderRadius: 6 }} />
                ) : (
                  <span
                    className="flex items-center justify-center w-10 h-10 shrink-0 bg-[#f3e7e1]"
                    style={{ color: accent, borderRadius: 6 }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.6} />
                  </span>
                )}
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-sm text-[#2a2622] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#6a6158]">
                    {formatSize(item.size)}
                    {item.status === 'uploading' && ' · מעלה...'}
                    {item.status === 'done' && ' · הועלה'}
                    {item.status === 'error' && ' · ההעלאה נכשלה, אפשר להסיר ולנסות שוב'}
                  </p>
                </div>
                {item.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-[#6a6158] shrink-0" />}
                {item.status === 'done' && <Check className="w-4 h-4 text-[#4A6355] shrink-0" />}
                {item.status === 'error' && <AlertCircle className="w-4 h-4 text-[#a33] shrink-0" />}
                <button
                  type="button"
                  aria-label="הסרת קובץ"
                  onClick={() => remove(item.id)}
                  className="text-[#8a8079] hover:text-[#5E1D1D] shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-xs text-[#a33] mt-2">{error}</p>}
    </div>
  );
}
