import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.GATHERLY_PORT || "3001");
const HEALTH_URL = process.env.GATHERLY_APP_HEALTH_URL || `http://127.0.0.1:${PORT}/api/health`;
const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_ROOT || "storage");
const WORKER_HEARTBEAT = path.join(STORAGE_ROOT, "runtime", "quick-analysis-worker.json");
const CODEX_BIN = process.env.GATHERLY_CODEX_BIN?.trim() || "codex";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return { status: result.status ?? -1, stdout: result.stdout?.trim() || "", stderr: result.stderr?.trim() || "" };
}

console.log("Gatherly doctor\n");

const listeners = run("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN"]);
console.log(`[1] Port ${PORT}`);
if (listeners.stdout) console.log(listeners.stdout);
else console.log("No listener found.");

const pids = run("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"]).stdout.split(/\s+/).filter(Boolean);
if (pids.length > 1) console.log(`⚠️  Duplicate listeners detected (${pids.length}). Stop old Gatherly processes before restarting.`);
else if (pids.length === 1) console.log("✅ Exactly one listener is active.");

console.log("\n[2] Local health");
const curl = run("curl", ["-fsS", "--max-time", "5", HEALTH_URL]);
if (curl.status === 0) console.log(`✅ ${HEALTH_URL}\n${curl.stdout}`);
else console.log(`❌ ${HEALTH_URL}\n${curl.stderr || "Health check failed."}`);

console.log("\n[3] Quick Analysis / Codex");
const codex = run(CODEX_BIN, ["--version"]);
if (codex.status === 0) console.log(`✅ Codex CLI: ${codex.stdout || codex.stderr || CODEX_BIN}`);
else console.log(`❌ Codex CLI not available via '${CODEX_BIN}'. If Codex is installed elsewhere, set GATHERLY_CODEX_BIN.`);
try {
  const fileStat = statSync(WORKER_HEARTBEAT);
  const ageMs = Date.now() - fileStat.mtimeMs;
  const heartbeat = JSON.parse(readFileSync(WORKER_HEARTBEAT, "utf8"));
  if (ageMs < 15_000) console.log(`✅ Quick Analysis worker online (pid=${heartbeat.pid ?? "?"}, state=${heartbeat.state ?? "?"}, heartbeat=${Math.round(ageMs / 1000)}s ago)`);
  else console.log(`⚠️  Quick Analysis worker heartbeat is stale (${Math.round(ageMs / 1000)}s ago). Restart Gatherly.`);
} catch {
  console.log("⚠️  Quick Analysis worker heartbeat not found. Restart Gatherly after running `npm run db:push`.");
}

console.log("\n[4] Tailscale Serve");
const serve = run("tailscale", ["serve", "status"]);
if (serve.status === 0 && serve.stdout) console.log(serve.stdout);
else console.log(serve.stderr || "Tailscale Serve status unavailable.");

console.log("\n[5] Tailscale peers");
const status = run("tailscale", ["status"]);
if (status.status === 0) console.log(status.stdout);
else console.log(status.stderr || "Tailscale status unavailable.");
