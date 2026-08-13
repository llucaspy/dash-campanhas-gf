import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getSponsorshipEmailAlertSettings } from "../../../../lib/appSettings";
import { loadCampaignsForOperationalAlerts } from "../../../../lib/operationalAlertCampaigns";
import { sendPushNotification } from "../../../../lib/pushNotifications";
import { buildOperationalEmailCampaigns, sendSponsorshipAlertEmail } from "../../../../lib/sponsorshipEmailAlerts";

const LAST_SPONSORSHIP_PUSH_KEY = "last_sponsorship_push_at";
const LAST_SPONSORSHIP_EMAIL_KEY = "last_sponsorship_email_alert_at";
const REMINDER_INTERVAL_MS = 40 * 60 * 1000;
const EMAIL_REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const campaigns = await loadCampaignsForOperationalAlerts();
  const operationalAlerts = buildOperationalEmailCampaigns(campaigns);
  const activeSponsorships = operationalAlerts.filter((item) => item.boostStatus === "sponsorship");

  if (operationalAlerts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "Sem campanhas com alerta operacional." });
  }

  const lastPush = await db.query<{ value: string | null }>(
    "select value from public.app_settings where key = $1 limit 1",
    [LAST_SPONSORSHIP_PUSH_KEY]
  );
  const lastPushAt = lastPush.rows[0]?.value ? new Date(lastPush.rows[0].value).getTime() : 0;
  const now = Date.now();

  if (lastPushAt && now - lastPushAt < REMINDER_INTERVAL_MS) {
    return NextResponse.json({ ok: true, sent: 0, reason: "Intervalo ainda nao atingido." });
  }

  const campaignNames = operationalAlerts
    .map((item) => item.campaign.campaignName)
    .slice(0, 4)
    .join(", ");
  const remainingCount = Math.max(operationalAlerts.length - 4, 0);

  const pushResult = await sendPushNotification(
    {
      title: operationalAlerts.length === 1 ? "Campanha pede verificacao" : "Campanhas pedem verificacao",
      body: `${campaignNames}${remainingCount ? ` e mais ${remainingCount}` : ""}. Confira status operacional, metricas e ritmo.`,
      url: "/",
      tag: "sponsorship-reminder",
      requireInteraction: true,
    },
    "admins"
  );

  const emailSettings = await getSponsorshipEmailAlertSettings();
  let emailResult: { sent: number; skipped: boolean; reason?: string; recipients?: string[] } = {
    sent: 0,
    skipped: true,
    reason: "Alertas de email desativados.",
  };

  if (emailSettings.enabled) {
    const lastEmail = await db.query<{ value: string | null }>(
      "select value from public.app_settings where key = $1 limit 1",
      [LAST_SPONSORSHIP_EMAIL_KEY]
    );
    const lastEmailAt = lastEmail.rows[0]?.value ? new Date(lastEmail.rows[0].value).getTime() : 0;

    if (lastEmailAt && now - lastEmailAt < EMAIL_REMINDER_INTERVAL_MS) {
      emailResult = { sent: 0, skipped: true, reason: "Intervalo de email ainda nao atingido." };
    } else {
      const emailInfo = await sendSponsorshipAlertEmail({
        to: emailSettings.recipients,
        campaigns: operationalAlerts,
      });

      await db.query(
        `
          insert into public.app_settings (key, value, updated_at)
          values ($1, to_jsonb($2::text), now())
          on conflict (key)
          do update set value = excluded.value, updated_at = now()
        `,
        [LAST_SPONSORSHIP_EMAIL_KEY, new Date(now).toISOString()]
      );

      emailResult = {
        sent: Array.isArray(emailInfo.accepted) ? emailInfo.accepted.length : emailSettings.recipients.length,
        skipped: false,
        recipients: emailSettings.recipients,
      };
    }
  }

  await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values ($1, to_jsonb($2::text), now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
    `,
    [LAST_SPONSORSHIP_PUSH_KEY, new Date(now).toISOString()]
  );

  return NextResponse.json({
    ok: true,
    push: pushResult,
    email: emailResult,
    operationalAlerts: operationalAlerts.length,
    activeSponsorships: activeSponsorships.length,
  });
}
