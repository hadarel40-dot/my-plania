// Phone navigation: three big buttons at the thumb, instead of tabs squeezed in a row.
export default function BottomNav({ items, value, onChange }) {
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#2a2622] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[720px] flex">
        {items.map((item) => {
          const Icon = item.icon;
          const active = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                active ? 'text-white' : 'text-white/55'
              }`}
            >
              {active && <span className="absolute top-0 inset-x-6 h-[2px] bg-[#B5848E]" />}
              <span className="relative">
                <Icon className="w-5 h-5" />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -left-3 min-w-[16px] h-4 px-1 rounded-full bg-[#B5848E] text-[#2a2622] text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
