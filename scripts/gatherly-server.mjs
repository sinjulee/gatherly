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

const managedChildren = [child, quickWorker, reportWorker].filter(Boolean);
const shutdownTimeoutMs = 5_000;
let shuttingDown = false;

function isRunning(processHandle) {
  return processHandle.exitCode === null && processHandle.signalCode === null;
}

function signalChild(processHandle, signal) {
  if (!isRunning(processHandle)) return;
  try {
    processHandle.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function waitForExit(processHandle, timeoutMs) {
  if (!isRunning(processHandle)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    processHandle.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopChildren(signal) {
  const running = managedChildren.filter(isRunning);
  for (const processHandle of running) signalChild(processHandle, signal);
  const stopped = await Promise.all(running.map((processHandle) => waitForExit(processHandle, shutdownTimeoutMs)));
  const remaining = running.filter((_, index) => !stopped[index] && isRunning(running[index]));
  for (const processHandle of remaining) signalChild(processHandle, "SIGKILL");
  if (remaining.length) {
    await Promise.all(remaining.map((processHandle) => waitForExit(processHandle, shutdownTimeoutMs)));
  }
}

async function shutdown(signal, exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await stopChildren(signal);
  } finally {
    process.exit(exitCode);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(signal, 0));
}

quickWorker?.on("exit", (code, signal) => {
  if (!shuttingDown && code !== 0) console.error(`[quick-analysis] worker stopped unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`);
});
reportWorker?.on("exit", (code, signal) => {
  if (!shuttingDown && code !== 0) console.error(`[final-report] worker stopped unexpectedly (code=${code ?? "?"}, signal=${signal ?? "none"}).`);
});

child.on("exit", (code, signal) => {
  if (shuttingDown) return;
  void shutdown("SIGTERM", code ?? (signal ? 1 : 0));
});
