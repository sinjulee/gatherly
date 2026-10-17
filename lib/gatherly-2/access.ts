import { createHash } from "node:crypto";
export type AccessType = "ADMIN" | "PREMIUM" | "TRIAL" | "FREE";
export type Mode = "PREOPEN_LIMITED" | "COUPON_ONLY" | "PREMIUM_ONLY";
export type Grant = { id: string; userId: string; kind: "PERIOD" | "ONE_TIME" | "PREMIUM"; source: "COUPON" | "MANUAL"; startsAt: number; expiresAt: number; limit: number; revoked?: boolean };
export type Reservation = { userId: string; key: string; grantId: string; reportId: string; operation: "CREATE" | "REVISE"; fingerprint: string; status: "RESERVED" | "COMMITTED" | "RELEASED"; reservedAt: number; expiresAt: number; documentId?: string };
export type Coupon = { hash: string; campaign: string; kind: "PERIOD" | "ONE_TIME"; durationMs: number; limit: number; expiresAt: number; maxRedemptions: number; campaignLimit: number; perUserLimit: number; revoked?: boolean };
export type AccessPolicy = { mode: Mode; honorExistingTrials: boolean; revisionLimit: number; revisionWindowMs: number; reservationTtlMs: number; totalOperationBudget: number };
export const couponHash = (value: string) => createHash("sha256").update(value.trim().toUpperCase()).digest("hex");
const keyOf = (userId: string, key: string) => JSON.stringify([userId, key]);
const positive = (n: number) => Number.isSafeInteger(n) && n > 0;

/** In-memory policy simulator only. No HTTP endpoint, real coupon issuance, or durable transaction. */
export class MockAccessService {
  private grants = new Map<string, Grant>();
  private reservations = new Map<string, Reservation>();
  private coupons = new Map<string, Coupon>();
  private redemptions = new Map<string, { hash: string; grantId: string; userId: string; campaign: string }>();
  private reports = new Map<string, { userId: string; createdAt: number }>();
  private audit: Array<{ actor: string; action: string }> = [];
  private policy: AccessPolicy;
  private admins: Set<string>;
  constructor(admins: string[], policy: AccessPolicy, private now = Date.now) {
    this.admins = new Set(admins); this.validatePolicy(policy); this.policy = { ...policy };
  }
  private validatePolicy(policy: AccessPolicy) {
    if (!positive(policy.reservationTtlMs) || !positive(policy.revisionWindowMs) || !positive(policy.totalOperationBudget) || !Number.isSafeInteger(policy.revisionLimit) || policy.revisionLimit < 0) throw new Error("INVALID_POLICY");
  }
  private admin(actor: string) { if (!this.admins.has(actor)) throw new Error("FORBIDDEN"); }
  setPolicy(actor: string, policy: AccessPolicy) { this.admin(actor); this.validatePolicy(policy); this.policy = { ...policy }; this.audit.push({ actor, action: "POLICY" }); }
  grant(actor: string, grant: Grant) {
    this.admin(actor);
    if (!grant.userId || !Number.isFinite(grant.startsAt) || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= grant.startsAt || !positive(grant.limit) || (grant.kind === "ONE_TIME" && grant.limit !== 1) || this.grants.has(grant.id)) throw new Error("INVALID_GRANT");
    this.grants.set(grant.id, { ...grant }); this.audit.push({ actor, action: "GRANT" });
  }
  revoke(actor: string, id: string) { this.admin(actor); const grant = this.grants.get(id); if (!grant) throw new Error("NOT_FOUND"); grant.revoked = true; this.audit.push({ actor, action: "REVOKE" }); }
  seedCoupon(actor: string, coupon: Coupon) {
    this.admin(actor);
    if (!positive(coupon.durationMs) || !positive(coupon.maxRedemptions) || !positive(coupon.campaignLimit) || !positive(coupon.perUserLimit) || !positive(coupon.limit) || (coupon.kind === "ONE_TIME" && coupon.limit !== 1) || this.coupons.has(coupon.hash)) throw new Error("INVALID_COUPON");
    if ([...this.coupons.values()].some(row => row.campaign === coupon.campaign && (row.campaignLimit !== coupon.campaignLimit || row.perUserLimit !== coupon.perUserLimit))) throw new Error("CAMPAIGN_POLICY_CONFLICT");
    this.coupons.set(coupon.hash, { ...coupon });
  }
  revokeCoupon(actor: string, hash: string) { this.admin(actor); const coupon = this.coupons.get(hash); if (!coupon) throw new Error("NOT_FOUND"); coupon.revoked = true; this.audit.push({ actor, action: "REVOKE_COUPON" }); }
  redeem(userId: string, code: string, requestId: string): Grant {
    if (!userId || !requestId) throw new Error("UNAUTHENTICATED_OR_MISSING_KEY");
    const key = keyOf(userId, requestId); const hash = couponHash(code);
    const previous = this.redemptions.get(key);
    if (previous) { if (previous.hash !== hash) throw new Error("IDEMPOTENCY_CONFLICT"); return { ...this.grants.get(previous.grantId)! }; }
    const coupon = this.coupons.get(hash);
    if (!coupon || coupon.revoked || coupon.expiresAt <= this.now() || this.policy.mode === "PREMIUM_ONLY") throw new Error("COUPON_UNAVAILABLE");
    const rows = [...this.redemptions.values()];
    if (rows.some(row => row.userId === userId && row.hash === hash) || rows.filter(row => row.hash === hash).length >= coupon.maxRedemptions || rows.filter(row => row.campaign === coupon.campaign).length >= coupon.campaignLimit || rows.filter(row => row.userId === userId && row.campaign === coupon.campaign).length >= coupon.perUserLimit) throw new Error("COUPON_LIMIT");
    const grant: Grant = { id: `coupon:${key}`, userId, kind: coupon.kind, source: "COUPON", startsAt: this.now(), expiresAt: this.now() + coupon.durationMs, limit: coupon.limit };
    this.grants.set(grant.id, grant); this.redemptions.set(key, { hash, userId, campaign: coupon.campaign, grantId: grant.id });
    this.audit.push({ actor: userId, action: "REDEEM" }); return { ...grant };
  }
  private active(grant: Grant, userId: string) { return grant.userId === userId && !grant.revoked && grant.startsAt <= this.now() && this.now() < grant.expiresAt; }
  private modeAllows(grant: Grant) { return grant.kind === "PREMIUM" || (this.policy.mode === "PREMIUM_ONLY" ? this.policy.honorExistingTrials : this.policy.mode !== "COUPON_ONLY" || grant.source === "COUPON"); }
  private used(grant: Grant) { return [...this.reservations.values()].filter(row => row.grantId === grant.id && row.operation === "CREATE" && row.status !== "RELEASED").length; }
  accessType(userId: string): AccessType {
    if (this.admins.has(userId)) return "ADMIN";
    const active = [...this.grants.values()].filter(grant => this.active(grant, userId));
    if (active.some(grant => grant.kind === "PREMIUM")) return "PREMIUM";
    return active.some(grant => grant.kind !== "PREMIUM" && this.used(grant) < grant.limit) ? "TRIAL" : "FREE";
  }
  reserve(input: Pick<Reservation, "userId" | "key" | "reportId" | "operation" | "fingerprint">): Reservation {
    if (!input.userId || !input.key || !input.reportId || !input.fingerprint) throw new Error("INVALID_REQUEST");
    const key = keyOf(input.userId, input.key); const previous = this.reservations.get(key);
    if (previous) {
      if (previous.fingerprint !== input.fingerprint || previous.operation !== input.operation || previous.reportId !== input.reportId) throw new Error("IDEMPOTENCY_CONFLICT");
      // A failed attempt remains terminal; retry uses a new request key after reconciliation.
      return { ...previous };
    }
    const rows = [...this.reservations.values()];
    if (rows.filter(row => row.status !== "RELEASED").length >= this.policy.totalOperationBudget) throw new Error("COST_LIMIT");
    const report = this.reports.get(input.reportId);
    if (input.operation === "CREATE") {
      if (report || rows.some(row => row.reportId === input.reportId && row.status !== "RELEASED")) throw new Error("REPORT_EXISTS");
    } else {
      if (!report || report.userId !== input.userId) throw new Error("FORBIDDEN");
      if (this.now() >= report.createdAt + this.policy.revisionWindowMs || rows.filter(row => row.reportId === input.reportId && row.operation === "REVISE" && row.status !== "RELEASED").length >= this.policy.revisionLimit) throw new Error("REVISION_LIMIT");
      if (rows.some(row => row.reportId === input.reportId && row.status === "RESERVED")) throw new Error("REPORT_BUSY");
    }
    const grant = [...this.grants.values()].filter(grant => this.active(grant, input.userId) && this.modeAllows(grant) && (input.operation === "REVISE" || this.used(grant) < grant.limit)).sort((a, b) => a.expiresAt - b.expiresAt)[0];
    if (!grant) throw new Error("ENTITLEMENT_REQUIRED");
    const reservation: Reservation = { ...input, grantId: grant.id, status: "RESERVED", reservedAt: this.now(), expiresAt: this.now() + this.policy.reservationTtlMs };
    this.reservations.set(key, reservation); return { ...reservation };
  }
  settle(userId: string, key: string, outcome: { success: false } | { success: true; documentId: string }): Reservation {
    const row = this.reservations.get(keyOf(userId, key)); if (!row) throw new Error("NOT_FOUND");
    const status = outcome.success ? "COMMITTED" : "RELEASED";
    if (outcome.success && !outcome.documentId) throw new Error("DOCS_NOT_CONFIRMED");
    if (row.status !== "RESERVED") {
      if (row.status !== status || (outcome.success && row.documentId !== outcome.documentId)) throw new Error("TERMINAL_CONFLICT");
      return { ...row };
    }
    row.status = status;
    if (outcome.success) {
      row.documentId = outcome.documentId;
      if (row.operation === "CREATE") this.reports.set(row.reportId, { userId, createdAt: this.now() });
    }
    this.audit.push({ actor: userId, action: status }); return { ...row };
  }
  recover(userId: string, key: string, result: "UNKNOWN" | "ABSENT" | { documentId: string }) {
    const row = this.reservations.get(keyOf(userId, key)); if (!row) throw new Error("NOT_FOUND");
    if (row.status !== "RESERVED" || row.expiresAt > this.now() || result === "UNKNOWN") return { ...row };
    return this.settle(userId, key, result === "ABSENT" ? { success: false } : { success: true, documentId: result.documentId });
  }
  canRead(userId: string, reportId: string) { return this.reports.get(reportId)?.userId === userId; }
  auditLog(actor: string) { this.admin(actor); return structuredClone(this.audit); }
}
