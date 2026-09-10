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
console.log("   Guard: duplicate listeners on port 3001 are blocked before startup.\n");

const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
