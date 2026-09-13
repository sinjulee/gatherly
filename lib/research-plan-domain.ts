export const RESEARCH_PLAN_STATUSES = ["DRAFT", "READY", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
export const RESEARCH_PRIORITIES = ["P1", "P2", "P3"] as const;
export const RESEARCH_TARGET_TYPES = ["COMPANY", "BOOTH", "PRODUCT", "TECHNOLOGY", "PERSON", "LOCATION", "CATEGORY", "OTHER"] as const;
export const RESEARCH_VISIT_STATUSES = ["PLANNED", "VISITING", "COMPLETED", "SKIPPED"] as const;
export const RESEARCH_CHECKPOINT_STATUSES = ["NOT_STARTED", "PARTIAL", "SATISFIED", "BLOCKED", "NOT_APPLICABLE"] as const;
export const REQUIRED_EVIDENCE_TYPES = ["IMAGE", "VIDEO", "AUDIO", "TEXT", "ANY"] as const;

export function cleanResearchText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function optionalResearchText(value: unknown, maxLength: number) {
  const text = cleanResearchText(value, maxLength);
  return text || null;
}

export function isResearchPlanStatus(value: unknown): value is (typeof RESEARCH_PLAN_STATUSES)[number] {
  return typeof value === "string" && RESEARCH_PLAN_STATUSES.includes(value as (typeof RESEARCH_PLAN_STATUSES)[number]);
}

export function isResearchPriority(value: unknown): value is (typeof RESEARCH_PRIORITIES)[number] {
  return typeof value === "string" && RESEARCH_PRIORITIES.includes(value as (typeof RESEARCH_PRIORITIES)[number]);
}

export function isResearchTargetType(value: unknown): value is (typeof RESEARCH_TARGET_TYPES)[number] {
  return typeof value === "string" && RESEARCH_TARGET_TYPES.includes(value as (typeof RESEARCH_TARGET_TYPES)[number]);
}

export function isResearchVisitStatus(value: unknown): value is (typeof RESEARCH_VISIT_STATUSES)[number] {
  return typeof value === "string" && RESEARCH_VISIT_STATUSES.includes(value as (typeof RESEARCH_VISIT_STATUSES)[number]);
}

export function isResearchCheckpointStatus(value: unknown): value is (typeof RESEARCH_CHECKPOINT_STATUSES)[number] {
  return typeof value === "string" && RESEARCH_CHECKPOINT_STATUSES.includes(value as (typeof RESEARCH_CHECKPOINT_STATUSES)[number]);
}

export function isRequiredEvidenceType(value: unknown): value is (typeof REQUIRED_EVIDENCE_TYPES)[number] {
  return typeof value === "string" && REQUIRED_EVIDENCE_TYPES.includes(value as (typeof REQUIRED_EVIDENCE_TYPES)[number]);
}
