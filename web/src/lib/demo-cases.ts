export type DemoCaseSeed = {
  patientName: string;
  age: number;
  clinicalNotes: string;
  rawDocumentText?: string;
  ocrText?: string | null;
  ocrConfidence?: number | null;
  inputSource: "paste" | "image" | "pdf";
  tags: string[];
  assignedClinician?: string | null;
};

/** Optional seed rows for `POST /api/cases/seed-demo` and Prisma seed. */
export const DEMO_CASE_SEEDS: DemoCaseSeed[] = [
  {
    patientName: "Morgan Ellis",
    age: 71,
    inputSource: "paste",
    tags: ["cardiac"],
    clinicalNotes:
      "Follow-up: dyspnea on exertion, resting SpO2 acceptable. Weight stable, eating normally. Denies chest pain. Home O2 2L prn.",
  },
  {
    patientName: "Sofia Reyes",
    age: 56,
    inputSource: "paste",
    tags: ["metabolic"],
    clinicalNotes: "HbA1c 8.8%, glucose elevated. Continues metformin. Reports fatigue; denies vomiting.",
  },
  {
    patientName: "James Ortiz",
    age: 73,
    inputSource: "image",
    tags: ["nutrition"],
    rawDocumentText:
      "Unintentional weight loss ~6kg over 6 weeks, poor appetite, winded on stairs, metformin 500mg",
    ocrText: "Unintentional weight loss ~6kg over 6 weeks, poor appetite, winded on stairs, metformin 500mg",
    ocrConfidence: 0.47,
    clinicalNotes: "Unintentional weight loss ~6kg over 6 weeks, poor appetite, winded on stairs, metformin 500mg",
  },
  {
    patientName: "Anne Park",
    age: 68,
    inputSource: "paste",
    tags: ["general"],
    clinicalNotes:
      "Vague complaint of feeling unwell a few days; history from patient unclear. No weights documented. Family mentioned tiredness.",
  },
];
