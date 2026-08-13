import { Pool } from "pg";

function normalizeEnvValue(value?: string) {
  return String(value || "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "")
    .trim();
}

const connectionString = normalizeEnvValue(process.env.DATABASE_URL) || normalizeEnvValue(process.env.DIRECT_URL);
const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX);
const poolMax = Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : process.env.NODE_ENV === "production" ? 1 : 5;

if (!connectionString && process.env.NODE_ENV !== "production") {
  console.warn("DATABASE_URL or DIRECT_URL is not configured.");
}

declare global {
  // eslint-disable-next-line no-var
  var appDbPool: Pool | undefined;
}

export const db =
  globalThis.appDbPool ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: poolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.appDbPool = db;
}

export type UserRole = "ADMIN" | "USER";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string;
  password_hash?: string;
  must_change_password?: boolean;
  has_seen_welcome?: boolean;
  role: UserRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}
