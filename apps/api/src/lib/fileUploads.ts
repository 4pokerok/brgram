import type { MultipartFile } from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export const MAX_CHAT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

type ErrorWithCode = {
  code?: string;
};

function sanitizeBaseName(value: string): string {
  const base = value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  return base.length > 0 ? base : "file";
}

function sanitizeExtension(value: string): string {
  if (!value) return "";
  if (!/^\.[a-zA-Z0-9]{1,16}$/.test(value)) return "";
  return value.toLowerCase();
}

function sanitizeOriginalFileName(filename?: string): string {
  if (!filename || filename.trim().length === 0) {
    return "file.bin";
  }

  const parsed = path.parse(filename);
  const baseName = sanitizeBaseName(parsed.name);
  const extension = sanitizeExtension(parsed.ext);
  return `${baseName}${extension}`;
}

function normalizeMimeType(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 255) : null;
}

function createUploadError(code: string, message: string): ErrorWithCode & Error {
  const error = new Error(message) as ErrorWithCode & Error;
  error.code = code;
  return error;
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

export async function saveUploadedFile(file: MultipartFile) {
  await ensureUploadsDir();

  const safeOriginalName = sanitizeOriginalFileName(file.filename);
  const storedName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
  const storedPath = path.join(UPLOADS_DIR, storedName);

  await pipeline(file.file, createWriteStream(storedPath));

  if (file.file.truncated) {
    await unlink(storedPath).catch(() => undefined);
    throw createUploadError("FILE_TOO_LARGE", "File is too large");
  }

  const uploadedStat = await stat(storedPath);
  const size = Number(uploadedStat.size);

  if (!Number.isFinite(size) || size <= 0) {
    await unlink(storedPath).catch(() => undefined);
    throw createUploadError("EMPTY_FILE", "File is empty");
  }

  if (size > MAX_CHAT_FILE_SIZE_BYTES) {
    await unlink(storedPath).catch(() => undefined);
    throw createUploadError("FILE_TOO_LARGE", "File is too large");
  }

  return {
    url: `/uploads/${storedName}`,
    name: safeOriginalName,
    size,
    mimeType: normalizeMimeType(file.mimetype),
  };
}

export function isUploadTooLargeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as ErrorWithCode).code;
  return code === "FST_REQ_FILE_TOO_LARGE" || code === "FILE_TOO_LARGE";
}
