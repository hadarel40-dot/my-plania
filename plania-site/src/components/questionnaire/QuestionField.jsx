import AgesField from './AgesField';
import FilesField from './FilesField';

const inputClass =
  'w-full bg-[#f2ece4] border border-[#e3d9cc] px-4 py-3 text-sm text-[#2a2622] placeholder:text-[#8a8079] focus:outline-none focus:border-[#a89b8d]';

export default function QuestionField({ question, value, otherValue, onChange, onOtherChange, error, accent }) {
  const optionRow = (selected) => ({
    borderColor: selected ? accent : '#e3d9cc',
    background: selected ? '#f6efe6' : '#f2ece4',
  });

  return (
    <div className="mb-5">
      <label className="block text-sm font-bold text-[#2a2622] mb-2 leading-relaxed">
        {question.label}
        {question.required && <span style={{ color: accent }}> *</span>}
      </label>
      {question.hint && (
        <p className="text-xs text-[#6a6158] leading-relaxed -mt-1 mb-3">{question.hint}</p>
      )}

      {question.type === 'short' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {question.type === 'email' && (
        <input
          type="email"
          dir="ltr"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} text-left`}
        />
      )}

      {question.type === 'ages' && (
        <AgesField value={value} onChange={onChange} accent={accent} />
      )}

      {question.type === 'long' && (
        <textarea
          rows={4}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {question.type === 'files' && (
        <FilesField value={value} onChange={onChange} accent={accent} />
      )}

      {question.type === 'single' && (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex items-start gap-3 border px-4 py-3.5 text-sm cursor-pointer"
              style={optionRow(value === option)}
            >
              <input
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange(option)}
                className="mt-0.5 shrink-0 w-5 h-5"
                style={{ accentColor: accent }}
              />
              <span>{option}</span>
            </label>
          ))}
          {question.other && (
            <div>
              <label
                className="flex items-start gap-3 border px-4 py-3 text-sm cursor-pointer"
                style={optionRow(value === '__other__')}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={value === '__other__'}
                  onChange={() => onChange('__other__')}
                  className="mt-0.5 shrink-0"
                  style={{ accentColor: accent }}
                />
                <span>אחר</span>
              </label>
              {value === '__other__' && (
                <input
                  type="text"
                  value={otherValue || ''}
                  onChange={(e) => onOtherChange(e.target.value)}
                  placeholder="נסחו במילים שלכם"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
          )}
        </div>
      )}

      {question.type === 'multi' && (
        <div className="space-y-2">
          {question.options.map((option) => {
            const list = Array.isArray(value) ? value : [];
            const checked = list.includes(option);
            return (
              <label
                key={option}
                className="flex items-start gap-3 border px-4 py-3.5 text-sm cursor-pointer"
                style={optionRow(checked)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? list.filter((v) => v !== option) : [...list, option])
                  }
                  className="mt-0.5 shrink-0"
                  style={{ accentColor: accent }}
                />
                <span>{option}</span>
              </label>
            );
          })}
          {question.other && (
            <div>
              <label
                className="flex items-start gap-3 border px-4 py-3 text-sm cursor-pointer"
                style={optionRow((value || []).includes('__other__'))}
              >
                <input
                  type="checkbox"
                  checked={(value || []).includes('__other__')}
                  onChange={() => {
                    const list = Array.isArray(value) ? value : [];
                    onChange(
                      list.includes('__other__')
                        ? list.filter((v) => v !== '__other__')
                        : [...list, '__other__']
                    );
                  }}
                  className="mt-0.5 shrink-0"
                  style={{ accentColor: accent }}
                />
                <span>אחר</span>
              </label>
              {(value || []).includes('__other__') && (
                <input
                  type="text"
                  value={otherValue || ''}
                  onChange={(e) => onOtherChange(e.target.value)}
                  placeholder="נסחו במילים שלכם"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-[#a33] mt-2">{error}</p>}
    </div>
  );
}