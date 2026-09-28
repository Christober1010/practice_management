const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function renderClientIntakePdfFromPages(pages: HTMLElement[]): Promise<Blob | null> {
  if (pages.length === 0) {
    return null;
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.82);
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    if (i > 0) {
      pdf.addPage();
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(imgHeight, pageHeight));
  }

  const ab: ArrayBuffer = pdf.output('arraybuffer');
  const blob = new Blob([ab], { type: 'application/pdf' });
  if (blob.size > MAX_PDF_BYTES) {
    return null;
  }
  return blob;
}

export async function renderClientIntakePdfBlob(container: HTMLElement): Promise<Blob | null> {
  const pages = Array.from(container.querySelectorAll<HTMLElement>('.page'));
  if (pages.length > 0) {
    return renderClientIntakePdfFromPages(pages);
  }
  return renderClientIntakePdfFromPages([container]);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read PDF blob'));
    reader.readAsDataURL(blob);
  });
}

/** Build a hidden print container, render official layout to PDF, then remove it. */
export async function renderClientIntakePdfFromData(
  bodyHtml: string,
  styles: string
): Promise<Blob | null> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:-1;';

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  host.appendChild(styleEl);

  const body = document.createElement('div');
  body.innerHTML = bodyHtml;
  host.appendChild(body);
  document.body.appendChild(host);

  try {
    return await renderClientIntakePdfBlob(body);
  } finally {
    host.remove();
  }
}

export const CLIENT_INTAKE_PRINT_STYLES = `
.page { width: 816px; min-height: 1056px; box-sizing: border-box; padding: 52px; background: #fff; font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; line-height: 1.35; }
.brand { text-align: center; margin-bottom: 10px; }
.brand-name { font-size: 14pt; font-weight: bold; }
.brand-tagline { font-size: 11pt; font-style: italic; margin-top: 2px; }
.doc-title { text-align: center; font-size: 13pt; font-weight: bold; margin: 8px 0 12px; }
.intro { font-size: 10.5pt; margin-bottom: 14px; text-align: justify; }
.section-title { font-size: 12pt; font-weight: bold; margin: 0 0 10px; border-bottom: 1px solid #333; padding-bottom: 4px; }
.q { margin: 0 0 10px; }
.q-num { font-weight: bold; }
.line { min-height: 18px; border-bottom: 1px solid #111; padding: 2px 0 1px; display: inline-block; }
.block { min-height: 48px; border-bottom: 1px solid #111; padding: 4px 0; margin-bottom: 8px; }
.pref-table, .med-table, .checkbox-table, .sig-table, .sick-table { width: 100%; border-collapse: collapse; }
.pref-table th, .pref-table td, .med-table th, .med-table td { border: 1px solid #333; padding: 6px; vertical-align: top; }
.pref-table th, .med-table th { font-weight: bold; background: #f5f5f5; }
.checkbox-table td { font-size: 10.5pt; padding: 3px 8px 3px 0; width: 33%; }
.sick-table td { font-size: 9.5pt; padding: 1px 10px 1px 0; width: 33%; }
.guidelines { font-size: 10pt; margin: 0; padding-left: 18px; }
.guidelines li { margin-bottom: 6px; }
.sig-table { margin-top: 14px; }
.sig-line { border-bottom: 1px solid #111; min-height: 52px; padding-bottom: 2px; }
.sig-caption { font-size: 10pt; margin-top: 4px; }
.signature-img { max-height: 48px; max-width: 280px; }
.consent-section { margin-bottom: 14px; }
.consent-title { font-size: 11pt; font-weight: bold; margin: 0 0 6px; text-transform: uppercase; }
.consent-body { margin: 0 0 6px; text-align: justify; font-size: 10pt; }
.consent-check { margin: 0; font-weight: bold; font-size: 10pt; }
.accepted { color: #0f5132; }
.declined { color: #842029; }
.child-line { margin: 12px 0 16px; font-size: 10.5pt; }
`;
