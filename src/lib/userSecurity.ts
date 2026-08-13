import { db } from "./db";

let ensurePasswordPolicyPromise: Promise<void> | null = null;

export function ensurePasswordPolicyColumn() {
  if (process.env.NODE_ENV === "production" && process.env.AUTO_MIGRATE_USER_SECURITY !== "true") {
    return Promise.resolve();
  }

  if (!ensurePasswordPolicyPromise) {
    ensurePasswordPolicyPromise = db
      .query(`
        alter table public.app_users
          add column if not exists must_change_password boolean not null default false,
          add column if not exists has_seen_welcome boolean not null default false
      `)
      .then(() => undefined);
  }

  return ensurePasswordPolicyPromise;
}
