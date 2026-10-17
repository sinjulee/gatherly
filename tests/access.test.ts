import test from "node:test";
import assert from "node:assert/strict";
import { MockAccessService, couponHash, type AccessPolicy, type Grant } from "../lib/gatherly-2/access";
const policy: AccessPolicy = { mode: "PREOPEN_LIMITED", honorExistingTrials: false, revisionLimit: 2, revisionWindowMs: 1000, reservationTtlMs: 50, totalOperationBudget: 20 };
function setup() {
  let now = 100;
  const service = new MockAccessService(["admin"], policy, () => now);
  const grant = (userId = "a", kind: Grant["kind"] = "ONE_TIME", limit = 1, id = userId) => service.grant("admin", { id, userId, kind, source: "MANUAL", startsAt: 100, expiresAt: 200, limit });
  const reserve = (key = "one", userId = "a", reportId = "r") => service.reserve({ userId, key, reportId, operation: "CREATE", fingerprint: "goal/evidence-v1" });
  return { service, grant, reserve, time: (value: number) => { now = value; } };
}
test("four display states; admin has no implicit generation bypass", () => {
  const { service, grant, reserve } = setup();
  assert.equal(service.accessType("a"), "FREE"); assert.throws(() => reserve(), /ENTITLEMENT/);
  assert.equal(service.accessType("admin"), "ADMIN"); assert.throws(() => reserve("admin", "admin"), /ENTITLEMENT/);
  grant(); assert.equal(service.accessType("a"), "TRIAL");
  grant("a", "PREMIUM", 5, "premium"); assert.equal(service.accessType("a"), "PREMIUM");
  assert.throws(() => service.grant("a", { id: "x", userId: "a", kind: "PREMIUM", source: "MANUAL", startsAt: 1, expiresAt: 300, limit: 9 }), /FORBIDDEN/);
  assert.throws(() => service.setPolicy("a", policy), /FORBIDDEN/);
});
test("ONE_TIME duplicate concurrent requests reserve exactly one right", async () => {
  const { service, grant, reserve } = setup(); grant();
  const result = await Promise.all(Array.from({ length: 10 }, async () => reserve()));
  assert.ok(result.every(row => row.key === "one"));
  assert.throws(() => reserve("two", "a", "r2"), /ENTITLEMENT/);
  assert.throws(() => service.reserve({ ...result[0], fingerprint: "different" }), /IDEMPOTENCY_CONFLICT/);
  service.settle("a", "one", { success: true, documentId: "doc" });
  assert.equal(service.settle("a", "one", { success: true, documentId: "doc" }).status, "COMMITTED");
  assert.equal(service.accessType("a"), "FREE");
});
test("PERIOD count/expiry; preauthorized work completes after expiry; old docs remain owned", () => {
  const { service, grant, reserve, time } = setup(); grant("a", "PERIOD", 2);
  reserve(); reserve("two", "a", "r2"); assert.throws(() => reserve("three", "a", "r3"), /ENTITLEMENT/);
  time(200); service.settle("a", "one", { success: true, documentId: "doc" });
  assert.equal(service.canRead("a", "r"), true); assert.equal(service.canRead("b", "r"), false);
  assert.equal(service.accessType("a"), "FREE"); assert.throws(() => reserve("four", "a", "r4"), /ENTITLEMENT/);
});
test("failed generation or Docs storage releases right; uncertain timeout does not double-spend", () => {
  const { service, grant, reserve, time } = setup(); grant(); reserve();
  assert.throws(() => service.settle("a", "one", { success: true, documentId: "" }), /DOCS/);
  time(151); assert.equal(service.recover("a", "one", "UNKNOWN").status, "RESERVED");
  assert.throws(() => reserve("two", "a", "r2"), /ENTITLEMENT/);
  assert.equal(service.recover("a", "one", "ABSENT").status, "RELEASED");
  assert.equal(reserve().status, "RELEASED"); // same key returns original outcome
  assert.equal(reserve("retry").status, "RESERVED");
  assert.throws(() => service.settle("a", "one", { success: true, documentId: "late" }), /TERMINAL/);
});
test("recovery commits confirmed remote output without charging a second report", () => {
  const { service, grant, reserve, time } = setup(); grant(); reserve(); time(151);
  assert.equal(service.recover("a", "one", { documentId: "doc" }).status, "COMMITTED");
  assert.throws(() => reserve("two", "a", "r2"), /ENTITLEMENT/);
});
test("AI revisions use separate budget and ownership, never another creation right", () => {
  const { service, grant, reserve, time } = setup(); grant(); reserve(); service.settle("a", "one", { success: true, documentId: "doc" });
  const revise = (key: string, userId = "a") => service.reserve({ userId, key, reportId: "r", operation: "REVISE", fingerprint: key });
  assert.throws(() => revise("bad", "b"), /FORBIDDEN/);
  revise("rev1"); service.settle("a", "rev1", { success: true, documentId: "doc" });
  revise("rev2"); service.settle("a", "rev2", { success: true, documentId: "doc" });
  assert.throws(() => revise("rev3"), /REVISION_LIMIT/);
  time(201); assert.equal(service.canRead("a", "r"), true);
});
test("coupon idempotency, competition, expiry and campaign per-user limit", async () => {
  const { service, time } = setup();
  const coupon = { hash: couponHash("TEST-ONLY"), campaign: "fake", kind: "ONE_TIME" as const, durationMs: 100, limit: 1, expiresAt: 150, maxRedemptions: 1, campaignLimit: 2, perUserLimit: 1 };
  service.seedCoupon("admin", coupon);
  const responses = await Promise.allSettled(["a", "b"].map(async user => service.redeem(user, "test-only", "redeem")));
  assert.equal(responses.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(service.redeem("a", " TEST-ONLY ", "redeem").userId, "a");
  assert.throws(() => service.redeem("a", "TEST-ONLY", "another"), /COUPON_LIMIT/);
  assert.throws(() => service.redeem("a", "other", "redeem"), /IDEMPOTENCY/);
  service.seedCoupon("admin", { ...coupon, hash: couponHash("second") });
  assert.throws(() => service.redeem("a", "second", "new"), /COUPON_LIMIT/);
  time(150); assert.throws(() => service.redeem("c", "second", "new"), /UNAVAILABLE/);
  assert.throws(() => service.auditLog("a"), /FORBIDDEN/);
  assert.ok(!JSON.stringify(service.auditLog("admin")).includes("TEST-ONLY"));
});
test("mode switch, premium manual grant/revoke and global budget", () => {
  const { service, grant, reserve } = setup(); grant();
  service.setPolicy("admin", { ...policy, mode: "COUPON_ONLY" }); assert.throws(() => reserve(), /ENTITLEMENT/);
  service.setPolicy("admin", { ...policy, mode: "PREMIUM_ONLY" }); assert.throws(() => reserve(), /ENTITLEMENT/);
  service.setPolicy("admin", { ...policy, mode: "PREMIUM_ONLY", honorExistingTrials: true }); reserve(); service.settle("a", "one", { success: false });
  grant("a", "PREMIUM", 3, "p");
  service.setPolicy("admin", { ...policy, mode: "PREMIUM_ONLY", totalOperationBudget: 1 }); reserve("p1");
  assert.throws(() => reserve("p2", "a", "r2"), /COST_LIMIT/);
  service.revoke("admin", "p"); assert.equal(service.accessType("a"), "TRIAL");
});

test("campaign-wide capacity and coupon revocation apply across different codes", () => {
  const { service } = setup();
  for (const code of ["first", "second"]) service.seedCoupon("admin", { hash: couponHash(code), campaign: "capacity", kind: "ONE_TIME", durationMs: 100, limit: 1, expiresAt: 200, maxRedemptions: 1, campaignLimit: 1, perUserLimit: 1 });
  service.redeem("a", "first", "one");
  assert.throws(() => service.redeem("b", "second", "one"), /COUPON_LIMIT/);
  service.revokeCoupon("admin", couponHash("second"));
  assert.throws(() => service.redeem("b", "second", "two"), /UNAVAILABLE/);
});
