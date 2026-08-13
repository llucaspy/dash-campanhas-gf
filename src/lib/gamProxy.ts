export const GAM_SERVICE_URL = (process.env.GAM_SERVICE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const GAM_API_TOKEN = process.env.GAM_API_TOKEN || "";

export function gamUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${GAM_SERVICE_URL}${normalizedPath}`;
}

export function gamHeaders(extraHeaders: HeadersInit = {}) {
  const headers = new Headers(extraHeaders);
  if (GAM_API_TOKEN) {
    headers.set("Authorization", `Bearer ${GAM_API_TOKEN}`);
  }
  return headers;
}
