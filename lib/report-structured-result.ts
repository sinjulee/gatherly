export const GATHERLY_REPORT_SCHEMA_VERSION = "gatherly.report.v1" as const;

export type EvidenceRef = {
  evidence_id: string;
  evidence_type: "FIELD" | "EXTERNAL" | "INFERENCE";
  material_id?: string | null;
  source_id?: string | null;
  summary: string;
};

export type ExternalSource = {
  source_id: string;
  title: string;
  publisher?: string | null;
  url?: string | null;
  published_at?: string | null;
  accessed_at?: string | null;
  source_tier?: "A" | "B" | "C" | "D" | null;
};

export type ReportMetric = {
  metric_id: string;
  name: string;
  value: number | string;
  unit?: string | null;
  period?: string | null;
  source_id?: string | null;
  confidence?: number | null;
};

export type ReportFinding = {
  finding_id: string;
  title: string;
  summary: string;
  evidence_refs: string[];
  confidence?: number | null;
};

export type ReportInsight = {
  insight_id: string;
  title: string;
  summary: string;
  implication?: string | null;
  evidence_refs: string[];
  confidence?: number | null;
};

export type ReportRecommendation = {
  recommendation_id: string;
  title: string;
  action: string;
  rationale?: string | null;
  priority?: "HIGH" | "MEDIUM" | "LOW" | null;
  evidence_refs: string[];
};

export type SelectedImage = {
  material_id: string;
  caption?: string | null;
  section_key?: string | null;
};

export type StructuredReportResult = {
  schema_version: typeof GATHERLY_REPORT_SCHEMA_VERSION;
  analysis_direction: string;
  executive_summary: string;
  findings: ReportFinding[];
  insights: ReportInsight[];
  recommendations: ReportRecommendation[];
  metrics: ReportMetric[];
  evidence_refs: EvidenceRef[];
  external_sources: ExternalSource[];
  selected_images: SelectedImage[];
  tags?: string[];
};

export function parseStructuredResult(value: unknown): StructuredReportResult {
  if (!value || typeof value !== "object") throw new Error("structured_result must be an object");
  const result = value as Record<string, unknown>;
  if (result.schema_version !== GATHERLY_REPORT_SCHEMA_VERSION) throw new Error("unsupported structured_result schema_version");
  if (typeof result.analysis_direction !== "string" || !result.analysis_direction.trim()) throw new Error("analysis_direction is required");
  if (typeof result.executive_summary !== "string") throw new Error("executive_summary must be a string");

  const arrayFields = ["findings", "insights", "recommendations", "metrics", "evidence_refs", "external_sources", "selected_images"] as const;
  for (const field of arrayFields) {
    if (!Array.isArray(result[field])) throw new Error(`${field} must be an array`);
  }

  return result as StructuredReportResult;
}

export function makePlanFrameIdempotencyKey(reportId: string, reportVersion: number) {
  return `gatherly:${reportId}:${reportVersion}`;
}
