import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STARTUP_TIMEOUT_MS = 30_000;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(currentDir, "server.ts");

console.log("[boot] Starting brgram API...");

let warnedAboutSlowStartup = false;
let startupComplete = false;
let startupTimer: NodeJS.Timeout | null = null;

function armTimer() {
  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = setTimeout(() => {
    warnedAboutSlowStartup = true;
    const timeoutSeconds = Math.round(STARTUP_TIMEOUT_MS / 1000);
    console.error(
      `\n[boot] API startup is taking more than ${timeoutSeconds}s.\n` +
        "[boot] If this project is in iCloud Desktop/Documents, Node can freeze on file reads.\n" +
        "[boot] Move the project to a local folder (for example /Users/<you>/Projects/brgram) and run npm install again.\n"
    );
  }, STARTUP_TIMEOUT_MS);
}

armTimer();

function markStartupComplete(outputChunk: Buffer | string) {
  if (startupComplete) return;
  const text = outputChunk.toString();
  if (!text.includes("API listening on")) return;

  startupComplete = true;
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
}

const tsxBin = process.platform === "win32" ? "tsx.cmd" : "tsx";

const child = spawn(tsxBin, [serverEntry], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  markStartupComplete(chunk);
  if (!warnedAboutSlowStartup && !startupComplete) {
    armTimer();
  }
  process.stdout.write(chunk);
});

child.stderr.on("data", (chunk) => {
  markStartupComplete(chunk);
  if (!warnedAboutSlowStartup && !startupComplete) {
    armTimer();
  }
  process.stderr.write(chunk);
});

child.on("error", (error) => {
  if (startupTimer) clearTimeout(startupTimer);
  console.error("[boot] Failed to start API child process:");
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (startupTimer) clearTimeout(startupTimer);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
