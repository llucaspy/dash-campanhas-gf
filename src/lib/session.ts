import type { UserRole } from "./db";

export const SESSION_COOKIE = "sense_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

interface SessionPayload extends SessionUser {
  iat: number;
  exp: number;
}

function getSecret() {
  return normalizeSecret(process.env.AUTH_SECRET) || "dev-only-change-this-auth-secret";
}

function normalizeSecret(value?: string) {
  return String(value || "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "")
    .trim();
}

function getSecretCandidates() {
  const fallback = "dev-only-change-this-auth-secret";
  const raw = process.env.AUTH_SECRET || fallback;
  const normalized = normalizeSecret(raw) || fallback;

  return Array.from(new Set([normalized, raw].filter(Boolean)));
}

function base64urlEncode(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(value: string, secret = getSecret()) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64urlEncode(new Uint8Array(signature));
}

export async function createSessionToken(user: SessionUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...user,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignatures = await Promise.all(getSecretCandidates().map((secret) => sign(body, secret)));
  if (!expectedSignatures.includes(signature)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(body)) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "ADMIN" && payload.role !== "USER") return null;
    return {
      id: payload.id,
      name: payload.name,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function isAdmin(user: SessionUser | null) {
  return user?.role === "ADMIN";
}
