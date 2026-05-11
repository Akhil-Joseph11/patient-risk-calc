import type { PrismaClient } from "@prisma/client";

import { enrichSignalsForPersistence } from "@/lib/extraction/enrich-evidence";
import { patchBundlePatientDemographics, runFullClinicalPipeline } from "@/lib/pipeline/full-clinical-pipeline";
import { deriveCaseReviewState } from "@/lib/review-state";

export type CreateCaseInput = {
  patientName: string;
  age: number;
  clinicalNotes: string;
  rawDocumentText?: string;
  ocrText?: string | null;
  ocrConfidence?: number | null;
  inputSource?: "paste" | "image" | "pdf";
  tags?: string[];
  assignedClinician?: string | null;
  clerkUserId?: string | null;
  guestSessionId?: string | null;
};

export async function persistAnalyzedCase(prisma: PrismaClient, input: CreateCaseInput) {
  const rawDocumentText = (input.rawDocumentText ?? input.clinicalNotes).trim();
  const clinicalNotes = input.clinicalNotes.trim();
  const inputSource = input.inputSource ?? "paste";

  const pipeline = await runFullClinicalPipeline(clinicalNotes, {
    ocrConfidence: input.ocrConfidence ?? null,
    patientName: input.patientName,
    age: input.age,
    inputSource,
    rawDocumentText,
  });

  const enriched = enrichSignalsForPersistence(pipeline.extraction, {
    rawDocumentText,
    clinicalNotes,
    inputSource,
    llmScoring: pipeline.scoringMethod === "rules-plus-llm",
  });

  const reviewState = deriveCaseReviewState({
    analysisConfidence: pipeline.analysisConfidence,
    ocrConfidence: input.ocrConfidence ?? null,
    inputSource,
    extractionKeys: enriched.map((e) => e.key),
    clinicalNote: clinicalNotes,
  });

  const bundle = patchBundlePatientDemographics(
    pipeline.structuredBundle,
    input.patientName.trim(),
    Math.round(input.age)
  );

  const tagsJson = JSON.stringify(input.tags ?? []);

  return prisma.patientCase.create({
    data: {
      clerkUserId: input.clerkUserId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      patientName: input.patientName.trim(),
      age: Math.round(input.age),
      clinicalNotes,
      rawDocumentText,
      ocrText: input.ocrText ?? null,
      ocrConfidence: input.ocrConfidence ?? null,
      inputSource,
      tags: tagsJson,
      assignedClinician: input.assignedClinician ?? null,
      riskScore: pipeline.risk.riskScore,
      riskLevel: pipeline.risk.riskLevel,
      signals: JSON.stringify(pipeline.risk.signals),
      signalEvidence: JSON.stringify(enriched),
      structuredRecord: JSON.stringify(bundle),
      explanation: pipeline.risk.explanation,
      analysisConfidence: pipeline.analysisConfidence,
      reviewState,
      pipelineTrace: pipeline.pipelineTraceJson,
    },
  });
}
