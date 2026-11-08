export default function StepList({ items, color }) {
  return (
    <ol className="space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 items-start leading-relaxed text-[#2a2622]">
          <span
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-sm"
            style={{ background: color }}
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}