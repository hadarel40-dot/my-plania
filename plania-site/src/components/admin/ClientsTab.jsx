import { useState } from 'react';

// Leads and both questionnaire types under one roof, switched with a filter.
export default function ClientsTab({ sections }) {
  const [active, setActive] = useState(sections[0].key);
  const current = sections.find((section) => section.key === active) || sections[0];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActive(section.key)}
            className={`text-xs px-3 py-2 border transition-colors flex items-center gap-2 ${
              active === section.key
                ? 'bg-[#5E1D1D] text-white border-[#5E1D1D]'
                : 'bg-[#faf6f1] text-[#2a2622] border-[#d9cfc2] hover:border-[#5E1D1D]'
            }`}
          >
            {section.label}
            {section.badge > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] ${
                  active === section.key ? 'bg-white text-[#5E1D1D]' : 'bg-[#5E1D1D] text-white'
                }`}
              >
                {section.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {current.render()}
    </div>
  );
}
