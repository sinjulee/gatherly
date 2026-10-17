import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
test("legacy SQLite baseline is read-only and preserves relationships and media", (t) => {
  if (!existsSync("prisma/dev.db")) { t.skip("Local-only legacy audit: private SQLite/media are intentionally excluded from Git."); return; }
  const output = execFileSync("python3", ["scripts/tests/legacy_readonly.py"], { encoding: "utf8" });
  assert.match(output, /PASS:/);
});
