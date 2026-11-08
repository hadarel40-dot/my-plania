// Turns the off-screen quote sheet into a single-page PDF (A4 width, as tall as the
// content) and lays real link areas over the buttons and addresses, so every link
// in the PDF is clickable.
export async function downloadQuotePdf(sheetElement, fileName) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ממשיכים גם אם הגופנים לא דווחו כנטענו
    }
  }

  const rootRect = sheetElement.getBoundingClientRect();
  const links = Array.from(sheetElement.querySelectorAll('[data-pdf-link]')).map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      url: node.getAttribute('data-pdf-link'),
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      w: rect.width,
      h: rect.height,
    };
  });

  const canvas = await html2canvas(sheetElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#f0e8df',
    logging: false,
  });

  const pageWidth = 210; // mm
  const scale = pageWidth / rootRect.width; // mm per css px
  const pageHeight = rootRect.height * scale;

  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, pageHeight], orientation: 'portrait' });
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);

  links.forEach((link) => {
    if (!link.url) return;
    doc.link(link.x * scale, link.y * scale, link.w * scale, link.h * scale, { url: link.url });
  });

  doc.setProperties({ title: fileName.replace(/\.pdf$/i, ''), author: 'Plania’s' });
  doc.save(fileName);
}
