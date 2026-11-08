export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function emailRow(label, value) {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#3e5449;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#2a2622;font-size:14px;white-space:pre-wrap;">${escapeHtml(value) || '—'}</td>
  </tr>`;
}

export function emailLinkRow(label, text, href) {
  const cell = href
    ? `<a href="${escapeHtml(href)}" style="color:#5E1D1D;text-decoration:underline;">${escapeHtml(text)}</a>`
    : escapeHtml(text);
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#3e5449;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#2a2622;font-size:14px;">${cell}</td>
  </tr>`;
}

export function emailShell(title, rowsHtml) {
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;background:#f0e8df;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#faf6f1;border:1px solid #e5e7eb;">
    <div style="background:#2a2622;color:#ffffff;padding:18px 24px;font-size:18px;">הדראל איפרגן</div>
    <div style="padding:24px;">
      <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#2a2622;margin:0 0 16px;font-weight:normal;">${escapeHtml(title)}</h1>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
    </div>
  </div>
</div>`;
}