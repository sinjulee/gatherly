import { spawn, spawnSync } from "node:child_process";

const HOST = process.env.GATHERLY_HOST || "0.0.0.0";
const PORT = Number(process.env.GATHERLY_PORT || "3001");
const mode = process.argv[2] === "start" ? "start" : "dev";

function listeners() {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  if (result.status !== 0 && result.status !== 1) return [];
  return [...new Set(result.stdout.split(/\s+/).map((value) => value.trim()).filter(Boolean))];
}

function describe(pid) {
  const result = spawnSync("ps", ["-p", pid, "-o", "pid=,ppid=,command="], { encoding: "utf8" });
  return result.stdout.trim();
}

const occupied = listeners();
if (occupied.length) {
  console.error(`\n❌ Gatherly cannot start: TCP ${PORT} is already in use.`);
  for (const pid of occupied) console.error(`   ${describe(pid) || `PID ${pid}`}`);
  console.error("\nRun `npm run doctor` to inspect the server state, then stop the old process before starting Gatherly again.\n");
  process.exit(1);
}

const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url).pathname;
const args = mode === "dev"
  ? [nextBin, "dev", "-H", HOST, "-p", String(PORT)]
  : [nextBin, "start", "-H", HOST, "-p", String(PORT)];

console.log(`▶ Gatherly ${mode} server: http://${HOST}:${PORT}`);
console.log("   Guard: duplicate listeners on port 3001 are blocked before startup.");

const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
const quickEnabled = process.env.GATHERLY_QUICK_ANALYSIS_WORKER !== "0";
const quickScript = new URL("./gatherly-quick-analysis-worker.mjs", import.meta.url).pathname;
const quickWorker = quickEnabled ? spawn(process.execPath, [quickScript], { stdio: "inherit", env: process.env }) : null;

const reportEnabled = process.env.GATHERLY_FINAL_REPORT_WORKER !== "0";
const reportScript = new URL("./gatherly-final-report-worker.mjs", import.meta.url).pathname;
const reportWorker = reportEnabled ? spawn(process.execPath, [reportScript], { stdio: "inherit", env: process.env }) : null;

console.log(quickWorker ? "   Quick Analysis: Codex worker started." : "   Quick Analysis: worker disabled.");
console.log(reportWorker ? "   Final Report: Codex worker started.\n" : "   Final Report: worker disabled.\n");

function stopChildren(signal) {
  if (!child.killed) child.kill(signal);
  if (quickWorker && !quickWorker.killed) quickWorker.kill(signal);
  if (reportWorker && !reportWorker.killed) reportWorker.kill(signal);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stopChildren(signal));

quickWorker?.on("exit", (code, signal) => {
  if (!child.killed && code !== 0) console.error(`[quick-analysis] worker stopped unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`);
});
reportWorker?.on("exit", (code, signal) => {
  if (!child.killed && code !== 0) console.error(`[final-report] worker stopped unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`);
});

child.on("exit", (code, signal) => {
  if (quickWorker && !quickWorker.killed) quickWorker.kill("SIGTERM");
  if (reportWorker && !reportWorker.killed) reportWorker.kill("SIGTERM");
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
