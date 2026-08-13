import webpush, { type PushSubscription } from "web-push";
import { db, type UserRole } from "./db";

type PushAudience = "all" | "admins" | "users";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:lucaspaim.dashboard@gmail.com";

let schemaReady = false;

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
}

function configureWebPush() {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  return true;
}

export async function ensurePushSchema() {
  if (schemaReady) return;

  await db.query(`
    create table if not exists public.push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.app_users(id) on delete cascade,
      endpoint text not null unique,
      p256dh text not null,
      auth text not null,
      user_agent text,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    )
  `);

  await db.query(`
    create index if not exists push_subscriptions_user_id_idx
      on public.push_subscriptions(user_id)
  `);

  await db.query(`
    create index if not exists push_subscriptions_active_idx
      on public.push_subscriptions(active)
  `);

  schemaReady = true;
}

export async function savePushSubscription({
  userId,
  subscription,
  userAgent,
}: {
  userId: string;
  subscription: PushSubscription;
  userAgent?: string | null;
}) {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("INVALID_PUSH_SUBSCRIPTION");
  }

  await ensurePushSchema();
  await db.query(
    `
      insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, active)
      values ($1, $2, $3, $4, $5, true)
      on conflict (endpoint)
      do update set
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        active = true,
        updated_at = now(),
        last_seen_at = now()
    `,
    [userId, endpoint, p256dh, auth, userAgent || null]
  );
}

export async function removePushSubscription(endpoint: string) {
  if (!endpoint) return;
  await ensurePushSchema();
  await db.query(
    `
      update public.push_subscriptions
      set active = false, updated_at = now()
      where endpoint = $1
    `,
    [endpoint]
  );
}

function audienceWhere(audience: PushAudience) {
  if (audience === "admins") return "and u.role = 'ADMIN'";
  if (audience === "users") return "and u.role = 'USER'";
  return "";
}

export async function sendPushNotification(payload: PushPayload, audience: PushAudience = "all") {
  if (!configureWebPush()) {
    console.warn("Push VAPID keys are not configured.");
    return { sent: 0, failed: 0, skipped: true };
  }

  await ensurePushSchema();

  const result = await db.query<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    role: UserRole;
  }>(
    `
      select ps.id, ps.endpoint, ps.p256dh, ps.auth, u.role
      from public.push_subscriptions ps
      join public.app_users u on u.id = ps.user_id
      where ps.active = true
        and u.active = true
        ${audienceWhere(audience)}
    `
  );

  let sent = 0;
  let failed = 0;

  await Promise.all(
    result.rows.map(async (item) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: {
              p256dh: item.p256dh,
              auth: item.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || "/",
            tag: payload.tag || "dashboard-gf",
            requireInteraction: Boolean(payload.requireInteraction),
          })
        );
        sent += 1;
      } catch (error: any) {
        failed += 1;
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await db.query(
            `
              update public.push_subscriptions
              set active = false, updated_at = now()
              where id = $1
            `,
            [item.id]
          );
        } else {
          console.error("Push notification failed", statusCode || error?.message || error);
        }
      }
    })
  );

  return { sent, failed, skipped: false };
}
