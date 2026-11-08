const inputClass =
  'w-full bg-[#f2ece4] border border-[#e3d9cc] px-4 py-3 text-sm text-[#2a2622] placeholder:text-[#8a8079] focus:outline-none focus:border-[#a89b8d]';

export default function ContractStep({ contract, signature, onChange, errors, accent, idLabel }) {
  const set = (field) => (event) =>
    onChange({ ...signature, [field]: field === 'agree' ? event.target.checked : event.target.value });

  return (
    <div>
      <p className="text-sm text-[#5a5249] leading-relaxed mb-4">
        לפני שליחת השאלון, קראו את ההסכם וחתמו עליו. המחיר הסופי יישלח אליכם בכתב, והעבודה תתחיל רק אחרי
        שתאשרו אותו.
      </p>

      <div
        className="max-h-[55vh] overflow-y-auto border border-[#e3d9cc] bg-white px-5 py-4 text-sm text-[#2a2622] leading-relaxed"
        tabIndex={0}
        aria-label="נוסח ההסכם"
      >
        <h3 className="font-heading text-lg mb-3" style={{ color: accent }}>
          {contract.title}
        </h3>
        {contract.sections.map((section, i) => (
          <section key={section.title} className="mb-4">
            <h4 className="font-bold mb-1.5">
              {i + 1}. {section.title}
            </h4>
            <ol className="space-y-1.5">
              {section.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 text-[#8a8079]">
                    {i + 1}.{j + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="signer_name" className="block text-sm font-bold text-[#2a2622] mb-2">
            שם מלא של החותם/ת <span style={{ color: accent }}>*</span>
          </label>
          <input id="signer_name" type="text" value={signature.name} onChange={set('name')} className={inputClass} />
          {errors.name && <p className="text-xs text-[#a33] mt-2">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="signer_id" className="block text-sm font-bold text-[#2a2622] mb-2">
            {idLabel} <span style={{ color: accent }}>*</span>
          </label>
          <input
            id="signer_id"
            type="text"
            inputMode="numeric"
            value={signature.idNumber}
            onChange={set('idNumber')}
            className={inputClass}
          />
          {errors.idNumber && <p className="text-xs text-[#a33] mt-2">{errors.idNumber}</p>}
        </div>

        <label className="flex items-start gap-3 border px-4 py-3 text-sm cursor-pointer" style={{ borderColor: signature.agree ? accent : '#e3d9cc', background: '#f2ece4' }}>
          <input
            type="checkbox"
            checked={signature.agree}
            onChange={set('agree')}
            className="mt-0.5 shrink-0"
            style={{ accentColor: accent }}
          />
          <span>
            קראתי את ההסכם ואני מסכים/ה לכל תנאיו. ידוע לי שסימון התיבה והקלדת שמי הם חתימה אלקטרונית
            שמחייבת אותי כמו חתימה בכתב יד.
          </span>
        </label>
        {errors.agree && <p className="text-xs text-[#a33] -mt-2">{errors.agree}</p>}
      </div>
    </div>
  );
}
