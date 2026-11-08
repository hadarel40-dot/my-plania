import { useEffect } from 'react';
import BulletList from './BulletList';
import { LAST_UPDATED } from '@/lib/legal';

export default function LegalPage({ doc }) {
  useEffect(() => {
    document.title = `${doc.title} | Plania's`;
  }, [doc.title]);

  return (
    <div className="mx-auto w-full max-w-[460px] md:max-w-[640px] lg:max-w-[820px] px-5 py-8 lg:py-12">
      <article className="bg-[#faf6f1] border-t-[8px] border-t-[#5E1D1D] px-6 py-8 lg:px-12 lg:py-12">
        <h1 className="font-heading text-3xl lg:text-4xl text-[#5E1D1D]">{doc.title}</h1>
        <p className="text-xs text-[#8a8079] mt-2">עודכן לאחרונה: {LAST_UPDATED}</p>
        <p className="text-[#2a2622] leading-relaxed mt-5">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.title} className="mt-8 pt-6 border-t border-dashed border-[#c9beb1]">
            <h2 className="font-heading text-xl text-[#5E1D1D] mb-3">{section.title}</h2>
            {section.list && <BulletList items={section.list} color="#B5848E" />}
            {section.text?.map((paragraph, i) => (
              <p key={i} className="text-[#2a2622] leading-relaxed mt-3">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
