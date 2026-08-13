import { NextResponse } from "next/server";

import { getGmailIntelligenceSettings } from "../../../../lib/appSettings";
import { db } from "../../../../lib/db";
import { syncGmailIntelligenceNow } from "../../../../lib/gmail/intelligence";

const LAST_GMAIL_AUTO_SYNC_KEY = "last_gmail_auto_sync_at";
const MIN_AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

function isAuthorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "")
    .trim();
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function getLastAutoSyncAt() {
  const result = await db.query<{ value: string | null }>(
    "select value from public.app_settings where key = $1 limit 1",
    [LAST_GMAIL_AUTO_SYNC_KEY]
  );
  return result.rows[0]?.value ? new Date(result.rows[0].value).getTime() : 0;
}

async function setLastAutoSyncAt(value: number) {
  await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values ($1, to_jsonb($2::text), now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
    `,
    [LAST_GMAIL_AUTO_SYNC_KEY, new Date(value).toISOString()]
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const settings = await getGmailIntelligenceSettings();
  const missingCredentials =
    !settings.credentialsConfigured.clientId ||
    !settings.credentialsConfigured.clientSecret ||
    !settings.credentialsConfigured.refreshTokenLucas;

  if (!settings.enabled || missingCredentials) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: !settings.enabled ? "Gmail Inteligente desativado." : "Credenciais Gmail incompletas.",
    });
  }

  const now = Date.now();
  const lastAutoSyncAt = await getLastAutoSyncAt();

  if (lastAutoSyncAt && now - lastAutoSyncAt < MIN_AUTO_SYNC_INTERVAL_MS) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Intervalo minimo ainda nao atingido.",
      lastAutoSyncAt: new Date(lastAutoSyncAt).toISOString(),
    });
  }

  try {
    const result = await syncGmailIntelligenceNow();
    await setLastAutoSyncAt(now);

    return NextResponse.json({
      ok: true,
      automatic: true,
      ...result,
    });
  } catch (error) {
    console.error("gmail_auto_sync_failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Nao foi possivel sincronizar o Gmail automaticamente." },
      { status: 500 }
    );
  }
}
