import { NextResponse } from "next/server";

import { getGmailIntelligenceSettings } from "../../../../../lib/appSettings";
import { requireRequestUser } from "../../../../../lib/apiAuth";
import { isLucasAccount } from "../../../../../lib/lucasAccess";

export async function POST() {
  const user = await requireRequestUser().catch(() => null);
  if (!isLucasAccount(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const settings = await getGmailIntelligenceSettings();
  const manualMissing: string[] = [];
  const automationMissing: string[] = [];

  if (!settings.enabled) manualMissing.push("monitoramento pausado");
  if (!settings.monitoredMailbox) manualMissing.push("caixa monitorada");
  if (settings.monitoredTargets.length === 0) manualMissing.push("alvos monitorados");
  if (!settings.credentialsConfigured.clientId) manualMissing.push("Client ID");
  if (!settings.credentialsConfigured.clientSecret) manualMissing.push("Client Secret");
  if (!settings.credentialsConfigured.refreshTokenLucas) manualMissing.push("Refresh Token Lucas");

  if (!settings.googleCloudProjectId) automationMissing.push("Google Cloud Project ID");
  if (!settings.pubsubTopic) automationMissing.push("Pub/Sub topic");
  if (!settings.pubsubSubscription) automationMissing.push("Pub/Sub subscription");
  if (!settings.credentialsConfigured.webhookSecret) automationMissing.push("Webhook Secret");

  const manualReady = manualMissing.length === 0;
  const automationReady = manualReady && automationMissing.length === 0;

  return NextResponse.json({
    status: manualReady ? "ready" : "pending",
    automationStatus: manualReady ? "ready" : "pending",
    realtimeStatus: automationReady ? "ready" : "pending",
    missing: manualMissing,
    realtimeMissing: automationMissing,
    message:
      manualReady
        ? automationReady
          ? "Configuracao pronta para sincronizacao manual, cron automatico e Pub/Sub."
          : `Pronto para sincronizacao manual e cron automatico. Para tempo real com Pub/Sub ainda falta: ${automationMissing.join(", ")}.`
        : `Ainda falta configurar: ${manualMissing.join(", ")}.`,
  });
}
