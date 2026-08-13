import { NextResponse } from "next/server";
import {
  getAssistantEnabled,
  getCommunicationsEnabled,
  getGmailIntelligenceSettings,
  getSponsorshipEmailAlertSettings,
  getUserInformationLevel,
  setAssistantEnabled,
  setCommunicationsEnabled,
  setGmailIntelligenceSettings,
  setSponsorshipEmailAlertSettings,
  setUserInformationLevel,
  type UserInformationLevel,
} from "../../../../lib/appSettings";
import { requireRequestUser } from "../../../../lib/apiAuth";
import { isLucasAccount } from "../../../../lib/lucasAccess";
import { isAdmin } from "../../../../lib/session";

async function requireAdminUser() {
  const user = await requireRequestUser();
  if (!isAdmin(user)) throw new Error("FORBIDDEN");
  return user;
}

export async function GET() {
  const user = await requireAdminUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });

  const communicationsEnabled = await getCommunicationsEnabled();
  const userInformationLevel = await getUserInformationLevel();
  const assistantEnabled = await getAssistantEnabled();
  const sponsorshipEmailAlerts = await getSponsorshipEmailAlertSettings();
  const canManageGmailIntelligence = isLucasAccount(user);
  const gmailIntelligence = canManageGmailIntelligence ? await getGmailIntelligenceSettings() : null;

  return NextResponse.json({
    communicationsEnabled,
    userInformationLevel,
    assistantEnabled,
    sponsorshipEmailAlerts,
    canManageGmailIntelligence,
    gmailIntelligence,
  });
}

export async function PATCH(request: Request) {
  const user = await requireAdminUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });

  const { communicationsEnabled, userInformationLevel, assistantEnabled, sponsorshipEmailAlerts, gmailIntelligence } = await request.json().catch(() => ({}));

  if (communicationsEnabled !== undefined && typeof communicationsEnabled !== "boolean") {
    return NextResponse.json({ error: "Informe um estado valido." }, { status: 400 });
  }

  if (userInformationLevel !== undefined && !["light", "adops"].includes(userInformationLevel)) {
    return NextResponse.json({ error: "Informe um nivel valido." }, { status: 400 });
  }

  if (assistantEnabled !== undefined && typeof assistantEnabled !== "boolean") {
    return NextResponse.json({ error: "Informe um estado valido para o assistente." }, { status: 400 });
  }

  if (
    sponsorshipEmailAlerts !== undefined &&
    (typeof sponsorshipEmailAlerts !== "object" ||
      sponsorshipEmailAlerts === null ||
      (sponsorshipEmailAlerts.enabled !== undefined && typeof sponsorshipEmailAlerts.enabled !== "boolean"))
  ) {
    return NextResponse.json({ error: "Informe uma configuracao valida para alertas por email." }, { status: 400 });
  }

  if (gmailIntelligence !== undefined && !isLucasAccount(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  if (
    gmailIntelligence !== undefined &&
    (typeof gmailIntelligence !== "object" ||
      gmailIntelligence === null ||
      (gmailIntelligence.enabled !== undefined && typeof gmailIntelligence.enabled !== "boolean") ||
      (gmailIntelligence.alertVisibility !== undefined && !["lucas_only", "admin"].includes(gmailIntelligence.alertVisibility)))
  ) {
    return NextResponse.json({ error: "Informe uma configuracao valida para o Gmail Inteligente." }, { status: 400 });
  }

  const enabled =
    communicationsEnabled === undefined ? await getCommunicationsEnabled() : await setCommunicationsEnabled(communicationsEnabled);
  const level =
    userInformationLevel === undefined
      ? await getUserInformationLevel()
      : await setUserInformationLevel(userInformationLevel as UserInformationLevel);
  const assistant =
    assistantEnabled === undefined ? await getAssistantEnabled() : await setAssistantEnabled(assistantEnabled);
  const sponsorshipEmail =
    sponsorshipEmailAlerts === undefined
      ? await getSponsorshipEmailAlertSettings()
      : await setSponsorshipEmailAlertSettings({
          enabled: sponsorshipEmailAlerts.enabled,
          recipients: sponsorshipEmailAlerts.recipients,
        }).catch(() => null);

  if (!sponsorshipEmail) {
    return NextResponse.json({ error: "Informe pelo menos um email valido para o alerta de patrocinio." }, { status: 400 });
  }

  const canManageGmailIntelligence = isLucasAccount(user);
  const gmail =
    gmailIntelligence === undefined
      ? canManageGmailIntelligence
        ? await getGmailIntelligenceSettings()
        : null
      : await setGmailIntelligenceSettings(gmailIntelligence);

  return NextResponse.json({
    communicationsEnabled: enabled,
    userInformationLevel: level,
    assistantEnabled: assistant,
    sponsorshipEmailAlerts: sponsorshipEmail,
    canManageGmailIntelligence,
    gmailIntelligence: gmail,
  });
}
