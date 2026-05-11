/** UI-only confidence heuristic (0–1). */
export function heuristicConfidenceFromText(text: string, engineConf01: number): number {
  const len = text.replace(/\s+/g, " ").trim().length;
  const density = Math.min(1, len / 400);
  const alphaRatio = len === 0 ? 0 : (text.match(/[a-zA-Z]/g) || []).length / Math.max(1, len);
  const messyPenalty = alphaRatio < 0.15 ? 0.55 : 1;
  const shortPenalty = len < 40 ? 0.5 : len < 120 ? 0.75 : 1;
  return Math.max(0.08, Math.min(0.98, engineConf01 * 0.55 + density * 0.35) * messyPenalty * shortPenalty);
}
