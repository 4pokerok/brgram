import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  process.env.ENV_FILE,
  path.resolve(process.cwd(), ".env"),
  path.resolve(currentDir, "../../../.env"),
  path.resolve(currentDir, "../../.env"),
].filter((value): value is string => Boolean(value));

const existingEnvPath = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(existingEnvPath ? { path: existingEnvPath } : undefined);

const missing: string[] = [];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    missing.push(name);
    return "";
  }
  return value;
}

const PORT = Number(process.env.PORT ?? 4000);
if (Number.isNaN(PORT)) missing.push("PORT");

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const CORS_ORIGINS = CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const WEBAUTHN_ORIGIN =
  process.env.WEBAUTHN_ORIGIN ??
  "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174";
const WEBAUTHN_ORIGINS = Array.from(
  new Set(
    WEBAUTHN_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .concat(CORS_ORIGINS)
  )
);
const WEBAUTHN_RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export function isAllowedCorsOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (CORS_ORIGINS.includes(origin)) return true;
  return isLocalhostOrigin(origin);
}

const JWT_SECRET = requireEnv("JWT_SECRET");
const DATABASE_URL = requireEnv("DATABASE_URL");

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

export const config = {
  PORT,
  CORS_ORIGIN,
  CORS_ORIGINS,
  WEBAUTHN_ORIGIN,
  WEBAUTHN_ORIGINS,
  WEBAUTHN_RP_ID,
  JWT_SECRET,
  DATABASE_URL,
};
