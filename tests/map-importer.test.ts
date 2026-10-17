import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FixtureDirectoryParser } from "../lib/gatherly-2/importer";
import { validGeometry, validHotspot, overlay, isTap, demoExhibitors, demoHotspots } from "../lib/gatherly-2/map";
test("normalized geometry and map/exhibition linkage reject invalid hotspots", () => {
  assert.ok(validHotspot(demoHotspots[0], demoExhibitors[0], "reference-v1"));
  assert.equal(validHotspot(demoHotspots[0], demoExhibitors[1], "reference-v1"), false);
  assert.equal(validHotspot(demoHotspots[0], demoExhibitors[0], "new-version"), false);
  assert.equal(validHotspot(demoHotspots[0], { ...demoExhibitors[0], exhibitionId: "other" }, "reference-v1"), false);
  for (const x of [-1, .99, NaN]) assert.equal(validGeometry({ x, y: 0, width: .2, height: .2 }), false);
  assert.deepEqual(overlay({ x: .1, y: .2, width: .3, height: .4 }), { left: "10%", top: "20%", width: "30%", height: "40%" });
});
test("pan, pointer cancel/scroll cannot select a booth; deliberate tap can", () => {
  assert.equal(isTap({ x: 0, y: 0 }, { x: 4, y: 3 }, false), true);
  assert.equal(isTap({ x: 0, y: 0 }, { x: 0, y: 10 }, false), false);
  assert.equal(isTap({ x: 0, y: 0 }, { x: 0, y: 0 }, true), false);
});
const html = readFileSync("tests/fixtures/directory-five.html", "utf8");
const parse = (input = html) => new FixtureDirectoryParser().parse(input, "synthetic-source", "2026-10-16T00:00:00Z");
test("five synthetic details retain source, bilingual fields and missing warnings; never publish", () => {
  const rows = parse(); assert.equal(rows.length, 5);
  assert.ok(rows.every(row => row.synthetic && row.status === "REVIEW" && row.warnings.includes("RIGHTS_UNVERIFIED")));
  assert.equal(rows[0].descriptionKo, "합성 파서 검증 자료 & 테스트"); assert.equal(rows[4].logoUrl, null);
  assert.ok(rows[4].warnings.includes("MISSING_DESCRIPTION")); assert.equal(rows[0].brandEn, "Test brand");
});
test("duplicate source ids, missing names and unsafe source URLs are rejected", () => {
  assert.ok(parse(html + html).slice(5).every(row => row.status === "INVALID"));
  assert.equal(parse(html.replace('https://fixture.invalid/detail/1', 'http://127.0.0.1/private'))[0].status, "INVALID");
  assert.equal(parse(html.replace('가상 테스트 기업 1', ''))[0].status, "INVALID");
});
