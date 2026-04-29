import { API_URL } from "./env";

export const MAX_CHAT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export type UploadedAttachment = {
  url: string;
  name: string;
  size: number;
  mimeType: string | null;
};

export function resolveAttachmentUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_URL}${url}`;
  return `${API_URL}/${url}`;
}

export function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";

  if (size < 1024) return `${size} B`;

  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function normalizeAttachmentName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "file";
}
