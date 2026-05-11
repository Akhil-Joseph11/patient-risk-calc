import { heuristicConfidenceFromText } from "./heuristics";

export type OcrProgress = { status: string; progress: number };

const TESSERACT_PKG = "5.1.1";
const WORKER_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@v${TESSERACT_PKG}/dist/worker.min.js`;
const CORE_URL = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_PKG}/tesseract-core-lstm.wasm.js`;

export async function ocrImageInBrowser(
  file: File,
  onProgress?: (p: OcrProgress) => void
): Promise<{ text: string; confidence: number; warnings: string[] }> {
  const warnings: string[] = [];
  if (file.type && !file.type.startsWith("image/")) {
    warnings.push("Unexpected MIME for image OCR path; results may be poor.");
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: WORKER_URL,
    corePath: CORE_URL,
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status) {
        onProgress?.({
          status: m.status,
          progress: typeof m.progress === "number" ? m.progress : 0,
        });
      }
    },
  });

  try {
    const ret = await worker.recognize(file);
    const text = (ret.data.text || "").trim();
    const engine01 = Math.max(0, Math.min(1, (ret.data.confidence ?? 40) / 100));
    if ((ret.data.confidence ?? 0) < 55) {
      warnings.push(
        "OCR confidence is low — handwriting and skew often need manual cleanup. Review and edit the extracted text before analysis."
      );
    }
    return {
      text,
      confidence: heuristicConfidenceFromText(text, engine01),
      warnings,
    };
  } catch (e) {
    warnings.push(`OCR failed: ${e instanceof Error ? e.message : "unknown error"}`);
    return { text: "", confidence: 0.12, warnings };
  } finally {
    await worker.terminate().catch(() => {});
  }
}
