export type RiskAnalysis = {
  signals: string[];
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  explanation: string;
};
