import { pdfExporter, type RawOrParsedDelta } from "quill-to-pdf";

//Tool to convert Quill input to pdf and download
//Uses quill-to-pdf which I found on Github
interface PdfOptions {
  title: string;
  delta: RawOrParsedDelta;
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.length > 0 ? trimmed : "document";
  return base.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

export async function downloadDocumentAsPdf({ title, delta }: PdfOptions): Promise<void> {
  const pdfBlob = await pdfExporter.generatePdf(delta);
  const url = URL.createObjectURL(pdfBlob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFileName(title)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
