import { API_URL } from "./env";

export async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormDataBody =
    typeof FormData !== "undefined" && init.body !== undefined && init.body instanceof FormData;

  if (!headers.has("Content-Type") && init.body && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let details: unknown = undefined;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    if (typeof details === "object" && details && "details" in details) {
      const fieldErrors = (details as { details?: { fieldErrors?: Record<string, string[]> } }).details?.fieldErrors;
      const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat().find(Boolean) : undefined;
      if (firstFieldError) {
        throw new Error(String(firstFieldError));
      }
    }

    throw new Error(
      typeof details === "object" && details && "error" in details
        ? String((details as { error: string }).error)
        : `Request failed: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}
