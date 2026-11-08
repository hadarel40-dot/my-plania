const inputClass =
  'w-full bg-[#f2ece4] border border-[#e3d9cc] px-4 py-3 text-sm text-[#2a2622] placeholder:text-[#8a8079] focus:outline-none focus:border-[#a89b8d]';

const MAX_TRAVELERS = 20;

export default function AgesField({ value, onChange, accent }) {
  const rows = Array.isArray(value) && value.length ? value : [''];

  const setRow = (index, next) =>
    onChange(rows.map((row, i) => (i === index ? next : row)));

  const addRow = () => {
    if (rows.length >= MAX_TRAVELERS) return;
    onChange([...rows, '']);
  };

  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div>
      <div className="space-y-2">
        {rows.map((age, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm text-[#5a5249]">נוסע {index + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="120"
              value={age ?? ''}
              onChange={(event) => setRow(index, event.target.value)}
              placeholder="גיל"
              className={inputClass}
            />
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="shrink-0 px-2 py-1 text-xs text-[#a33]"
              >
                הסרה
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 text-sm font-bold"
        style={{ color: accent }}
      >
        + הוספת נוסע
      </button>
    </div>
  );
}