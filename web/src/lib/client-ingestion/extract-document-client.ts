import { extractPdfTextInBrowser } from "./pdf-text-browser";
import { ocrImageInBrowser } from "./ocr-image-browser";

export const CLIENT_INGEST_MAX_BYTES = 6 * 1024 * 1024;

export type ExtractDocumentClientResult = {
  extractedText: string;
  ocrConfidence: number;
  warnings: string[];
  inputSource: "image" | "pdf";
};

function isLikelyPdf(file: File): boolean {
  const n = file.name.toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (t === "application/pdf" || t === "application/x-pdf") return true;
  if (t === "application/octet-stream" && n.endsWith(".pdf")) return true;
  return n.endsWith(".pdf");
}

function isLikelyImage(file: File): boolean {
  const n = file.name.toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  if (t === "image/pjpeg" || t === "image/x-png") return true;
  if ((t === "" || t === "application/octet-stream") && /\.(png|jpe?g|webp|gif|bmp)$/i.test(n)) return true;
  return /\.(png|jpe?g|webp)$/i.test(n);
}

export async function extractDocumentInBrowser(
  file: File,
  opts?: {
    onPhase?: (label: string) => void;
    onOcrProgress?: (p: { status: string; progress: number }) => void;
    onPdfPage?: (p: { page: number; total: number }) => void;
  }
): Promise<ExtractDocumentClientResult> {
  if (file.size > CLIENT_INGEST_MAX_BYTES) {
    throw new Error(`File too large for browser extraction (max ${CLIENT_INGEST_MAX_BYTES / 1024 / 1024} MB).`);
  }

  opts?.onPhase?.("Reading file…");

  if (isLikelyPdf(file)) {
    opts?.onPhase?.("Extracting PDF text in your browser…");
    const r = await extractPdfTextInBrowser(file, opts?.onPdfPage);
    return {
      extractedText: r.text,
      ocrConfidence: r.confidence,
      warnings: r.warnings,
      inputSource: "pdf",
    };
  }

  if (isLikelyImage(file)) {
    opts?.onPhase?.("Running OCR in your browser (file stays on-device until you save)…");
    const r = await ocrImageInBrowser(file, opts?.onOcrProgress);
    return {
      extractedText: r.text,
      ocrConfidence: r.confidence,
      warnings: r.warnings,
      inputSource: "image",
    };
  }

  throw new Error("Unsupported file type. Use PDF, PNG, JPEG, or WebP.");
}
