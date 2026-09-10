import { spawnSync } from "node:child_process";

const PORT = Number(process.env.GATHERLY_PORT || "3001");
const HEALTH_URL = process.env.GATHERLY_APP_HEALTH_URL || `http://127.0.0.1:${PORT}/api/health`;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return { status: result.status ?? -1, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
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

console.log("\n[3] Tailscale Serve");
const serve = run("tailscale", ["serve", "status"]);
if (serve.status === 0 && serve.stdout) console.log(serve.stdout);
else console.log(serve.stderr || "Tailscale Serve status unavailable.");

console.log("\n[4] Tailscale peers");
const status = run("tailscale", ["status"]);
if (status.status === 0) console.log(status.stdout);
else console.log(status.stderr || "Tailscale status unavailable.");
