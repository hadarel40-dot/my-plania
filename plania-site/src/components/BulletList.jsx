export default function BulletList({ items, color, cards = false }) {
  // `cards` keeps the plain bullet list on mobile and turns each item into a card on desktop
  const itemClass = cards
    ? 'lg:bg-white lg:border lg:border-[#e3d9cc] lg:border-r-4 lg:px-5 lg:py-4 lg:transition-all lg:duration-300 lg:hover:-translate-y-0.5 lg:hover:shadow-[0_10px_30px_rgba(94,29,29,0.08)]'
    : '';

  return (
    <ul className={cards ? 'space-y-2.5 lg:space-y-3' : 'space-y-2.5'}>
      {items.map((item, i) => (
        <li
          key={i}
          className={`flex gap-3 items-start leading-relaxed text-[#2a2622] ${itemClass}`}
          style={cards ? { borderRightColor: color } : undefined}
        >
          <span
            className="mt-2.5 w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: color }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
