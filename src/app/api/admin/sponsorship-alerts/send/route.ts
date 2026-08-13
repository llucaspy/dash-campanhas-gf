import { NextResponse } from "next/server";
import { getSponsorshipEmailAlertSettings } from "../../../../../lib/appSettings";
import { getRequestUser } from "../../../../../lib/apiAuth";
import { loadCampaignsForOperationalAlerts } from "../../../../../lib/operationalAlertCampaigns";
import { isAdmin } from "../../../../../lib/session";
import { buildOperationalEmailCampaigns, sendSponsorshipAlertEmail } from "../../../../../lib/sponsorshipEmailAlerts";

function normalizeEmailList(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];

  return Array.from(
    new Set(
      source
        .map((item) => String(item || "").trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
  );
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const bodyRecipients = normalizeEmailList(body.recipients);
  const settings = await getSponsorshipEmailAlertSettings();
  const recipients = bodyRecipients.length > 0 ? bodyRecipients : settings.recipients;

  if (recipients.length === 0) {
    return NextResponse.json({ error: "Informe pelo menos um email valido." }, { status: 400 });
  }

  const campaigns = await loadCampaignsForOperationalAlerts();
  const operationalAlerts = buildOperationalEmailCampaigns(campaigns);

  if (operationalAlerts.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: true,
      reason: "Nenhuma campanha com sinal operacional relevante para email.",
      activeCampaigns: campaigns.length,
    });
  }

  try {
    const emailInfo = await sendSponsorshipAlertEmail({
      to: recipients,
      campaigns: operationalAlerts,
    });

    return NextResponse.json({
      ok: true,
      sent: Array.isArray(emailInfo.accepted) ? emailInfo.accepted.length : recipients.length,
      rejected: emailInfo.rejected || [],
      recipients,
      campaigns: operationalAlerts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar alerta de sponsorship.";
    console.error("manual-sponsorship-alert", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
