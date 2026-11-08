export default function QuestionnaireAnswers({ items }) {
  if (!items?.length) return null;

  return (
    <div className="space-y-2 bg-white border border-dashed border-[#e3d9cc] px-3 py-2">
      {items.map((item, index) => (
        <div key={index}>
          <p className="text-[11px] text-[#6a6158]">
            {item.section ? `${item.section} · ${item.question}` : item.question}
          </p>
          <p className="text-sm text-[#2a2622] whitespace-pre-wrap">{item.answer || '—'}</p>
        </div>
      ))}
    </div>
  );
}