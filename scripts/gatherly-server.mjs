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
const workerEnabled = process.env.GATHERLY_QUICK_ANALYSIS_WORKER !== "0";
const workerScript = new URL("./gatherly-quick-analysis-worker.mjs", import.meta.url).pathname;
const worker = workerEnabled
  ? spawn(process.execPath, [workerScript], { stdio: "inherit", env: process.env })
  : null;

if (worker) console.log("   Quick Analysis: Mac mini Codex worker started with the web server.\n");
else console.log("   Quick Analysis: worker disabled by GATHERLY_QUICK_ANALYSIS_WORKER=0.\n");

function stopChildren(signal) {
  if (!child.killed) child.kill(signal);
  if (worker && !worker.killed) worker.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopChildren(signal));
}

worker?.on("exit", (code, signal) => {
  if (!child.killed && code !== 0) {
    console.error(`[quick-analysis] worker stopped unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}). Restart Gatherly after checking the log.`);
  }
});

child.on("exit", (code, signal) => {
  if (worker && !worker.killed) worker.kill("SIGTERM");
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
