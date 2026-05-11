import { heuristicConfidenceFromText } from "./heuristics";

export async function extractPdfTextInBrowser(
  file: File,
  onProgress?: (p: { page: number; total: number }) => void
): Promise<{ text: string; confidence: number; warnings: string[] }> {
  const warnings: string[] = [];
  const buf = await file.arrayBuffer();

  const pdfjs = await import("pdfjs-dist");
  const version = pdfjs.version;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  } catch (e) {
    warnings.push(`PDF open failed: ${e instanceof Error ? e.message : "unknown error"}`);
    return { text: "", confidence: 0.1, warnings };
  }

  const numPages = pdf.numPages;
  let full = "";

  for (let i = 1; i <= numPages; i++) {
    onProgress?.({ page: i, total: numPages });
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    for (const item of tc.items) {
      if ("str" in item && typeof item.str === "string") {
        full += item.str;
        if ("hasEOL" in item && item.hasEOL) full += "\n";
      }
    }
    full += "\n";
  }

  const text = full.replace(/\n{3,}/g, "\n\n").trim();

  if (!text || text.length < 20) {
    warnings.push(
      "PDF returned very little selectable text — it may be a scanned document. Try uploading an image for browser OCR, or paste the note text."
    );
    return { text: text || "", confidence: 0.22, warnings };
  }

  if (numPages > 8) {
    warnings.push("Large PDF — all pages are parsed in the browser; very long files may be slow.");
  }

  return {
    text,
    confidence: heuristicConfidenceFromText(text, 0.85),
    warnings,
  };
}
