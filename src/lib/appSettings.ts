import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAppUrl } from "./accessEmail";
import { db } from "./db";

const COMMUNICATIONS_KEY = "communications_enabled";
const USER_INFORMATION_LEVEL_KEY = "user_information_level";
const ASSISTANT_ENABLED_KEY = "assistant_enabled";
const SPONSORSHIP_EMAIL_ALERTS_ENABLED_KEY = "sponsorship_email_alerts_enabled";
const SPONSORSHIP_EMAIL_ALERT_RECIPIENTS_KEY = "sponsorship_email_alert_recipients";
const GMAIL_INTELLIGENCE_SETTINGS_KEY = "gmail_intelligence_settings";
const GMAIL_CLIENT_ID_KEY = "gmail_intelligence_client_id";
const GMAIL_CLIENT_SECRET_KEY = "gmail_intelligence_client_secret";
const GMAIL_REFRESH_TOKEN_LUCAS_KEY = "gmail_intelligence_refresh_token_lucas";
const GMAIL_WEBHOOK_SECRET_KEY = "gmail_intelligence_webhook_secret";

export const DEFAULT_SPONSORSHIP_EMAIL_ALERT_RECIPIENTS = ["lucas.mendonca@metropoles.com"];
const DEFAULT_GMAIL_TARGETS = ["lucas.mendonca@metropoles.com", "opec.gov@metropoles.com", "Lucas", "OPEC"];
const DEFAULT_GMAIL_KEYWORDS = [
  "PI",
  "campanha",
  "veiculacao",
  "entrega",
  "patrocinio",
  "sponsorship",
  "aprovacao",
  "urgente",
  "erro",
  "prazo",
  "Tags",
  "Tag",
  "metrike",
  "brasil adserver",
  "adforce",
  "adserver",
  "Governo Federal",
  "programar",
  "banner",
  "subir",
  "verification",
  "abatimento",
  "BS",
  "viewability",
  "VA",
  "brand safety",
];
const DEFAULT_GMAIL_IGNORED_SENDERS = ["noreply", "no-reply", "newsletter"];
const DEFAULT_GMAIL_IMPORTANT_SENDERS = [
  "checking@metrike.com",
  "operacional@aheadserver.com.br",
  "suporte@adxspace.com.br",
  "suporte@brasiladserver.com",
  "joao@adforce.com.br",
  "suporte@vetta.net.br",
  "suporte@adserverstart.com",
];
const DEFAULT_GMAIL_IMPORTANT_SENDER_COLOR = "#2563EB";

export type UserInformationLevel = "light" | "adops";
export type GmailAlertVisibility = "lucas_only" | "admin";

export interface GmailIntelligenceSettings {
  enabled: boolean;
  monitoredMailbox: string;
  monitoredTargets: string[];
  strongKeywords: string[];
  ignoredSenders: string[];
  importantSenders: string[];
  importantSenderColor: string;
  googleCloudProjectId: string;
  pubsubTopic: string;
  pubsubSubscription: string;
  alertVisibility: GmailAlertVisibility;
  webhookUrl: string;
  credentialsConfigured: {
    clientId: boolean;
    clientSecret: boolean;
    refreshTokenLucas: boolean;
    webhookSecret: boolean;
  };
}

export interface GmailIntelligenceSettingsInput {
  enabled?: boolean;
  monitoredMailbox?: string;
  monitoredTargets?: unknown;
  strongKeywords?: unknown;
  ignoredSenders?: unknown;
  importantSenders?: unknown;
  importantSenderColor?: string;
  googleCloudProjectId?: string;
  pubsubTopic?: string;
  pubsubSubscription?: string;
  alertVisibility?: GmailAlertVisibility;
  clientId?: string;
  clientSecret?: string;
  refreshTokenLucas?: string;
  webhookSecret?: string;
}

export interface GmailIntelligenceSecrets {
  clientId: string;
  clientSecret: string;
  refreshTokenLucas: string;
  webhookSecret: string;
}

function normalizeEmailList(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];

  return Array.from(
    new Set(
      source
        .map((item) => String(item || "").trim().toLowerCase())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    )
  );
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeSecretSource(value?: string) {
  return normalizeText(value)
    .replace(/\\r/g, "")
    .replace(/\\n/g, "")
    .trim();
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTextList(value: unknown, fallback: string[]) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];
  const normalized = Array.from(
    new Set(
      source
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeHexColor(value: unknown, fallback = DEFAULT_GMAIL_IMPORTANT_SENDER_COLOR) {
  const color = normalizeText(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

function getSecretEncryptionSources() {
  const fallback = "dev-only-change-this-gmail-secret";
  const raw = process.env.GMAIL_ENCRYPTION_SECRET || process.env.AUTH_SECRET || fallback;
  const normalized = normalizeSecretSource(raw) || fallback;

  return uniqueText([normalized, raw]);
}

function getSecretEncryptionKey() {
  const source = getSecretEncryptionSources()[0];
  return createHash("sha256").update(source).digest();
}

function getSecretDecryptionKeys() {
  return getSecretEncryptionSources().map((source) => createHash("sha256").update(source).digest());
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecretEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptSecret(value: unknown) {
  const source = normalizeText(value);
  if (!source) return "";

  const [version, iv, tag, encrypted] = source.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) return source;

  for (const key of getSecretDecryptionKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));

      return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
    } catch {
      // Try the next key candidate. Some environments imported secrets with a trailing newline.
    }
  }

  throw new Error("Nao foi possivel descriptografar as credenciais do Gmail.");
}

function normalizeGmailSettings(value: unknown) {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const alertVisibility: GmailAlertVisibility = source.alertVisibility === "admin" ? "admin" : "lucas_only";

  return {
    enabled: source.enabled === true,
    monitoredMailbox: normalizeText(source.monitoredMailbox) || "lucas.mendonca@metropoles.com",
    monitoredTargets: normalizeTextList(source.monitoredTargets, DEFAULT_GMAIL_TARGETS),
    strongKeywords: normalizeTextList(source.strongKeywords, DEFAULT_GMAIL_KEYWORDS),
    ignoredSenders: normalizeTextList(source.ignoredSenders, DEFAULT_GMAIL_IGNORED_SENDERS),
    importantSenders: normalizeEmailList(source.importantSenders).length > 0 ? normalizeEmailList(source.importantSenders) : DEFAULT_GMAIL_IMPORTANT_SENDERS,
    importantSenderColor: normalizeHexColor(source.importantSenderColor),
    googleCloudProjectId: normalizeText(source.googleCloudProjectId),
    pubsubTopic: normalizeText(source.pubsubTopic),
    pubsubSubscription: normalizeText(source.pubsubSubscription),
    alertVisibility,
  };
}

export async function getCommunicationsEnabled() {
  const result = await db.query("select value from public.app_settings where key = $1 limit 1", [COMMUNICATIONS_KEY]);

  if (result.rowCount === 0) return true;
  return result.rows[0].value !== false;
}

export async function setCommunicationsEnabled(enabled: boolean) {
  const result = await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values ($1, to_jsonb($2::boolean), now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
      returning value
    `,
    [COMMUNICATIONS_KEY, enabled]
  );

  return result.rows[0].value !== false;
}

export async function getUserInformationLevel(): Promise<UserInformationLevel> {
  const result = await db.query("select value from public.app_settings where key = $1 limit 1", [USER_INFORMATION_LEVEL_KEY]);
  const value = result.rows[0]?.value;

  return value === "adops" ? "adops" : "light";
}

export async function setUserInformationLevel(level: UserInformationLevel) {
  const normalizedLevel = level === "adops" ? "adops" : "light";
  const result = await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values ($1, to_jsonb($2::text), now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
      returning value
    `,
    [USER_INFORMATION_LEVEL_KEY, normalizedLevel]
  );

  return result.rows[0].value === "adops" ? "adops" : "light";
}

export async function getAssistantEnabled() {
  const result = await db.query("select value from public.app_settings where key = $1 limit 1", [ASSISTANT_ENABLED_KEY]);

  if (result.rowCount === 0) return true;
  return result.rows[0].value !== false;
}

export async function setAssistantEnabled(enabled: boolean) {
  const result = await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values ($1, to_jsonb($2::boolean), now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
      returning value
    `,
    [ASSISTANT_ENABLED_KEY, enabled]
  );

  return result.rows[0].value !== false;
}

export async function getSponsorshipEmailAlertSettings() {
  const result = await db.query(
    "select key, value from public.app_settings where key = any($1::text[])",
    [[SPONSORSHIP_EMAIL_ALERTS_ENABLED_KEY, SPONSORSHIP_EMAIL_ALERT_RECIPIENTS_KEY]]
  );
  const settings = new Map(result.rows.map((row) => [row.key, row.value]));
  const enabled = settings.get(SPONSORSHIP_EMAIL_ALERTS_ENABLED_KEY) === true;
  const recipients = normalizeEmailList(settings.get(SPONSORSHIP_EMAIL_ALERT_RECIPIENTS_KEY));

  return {
    enabled,
    recipients: recipients.length > 0 ? recipients : DEFAULT_SPONSORSHIP_EMAIL_ALERT_RECIPIENTS,
  };
}

export async function setSponsorshipEmailAlertSettings({
  enabled,
  recipients,
}: {
  enabled?: boolean;
  recipients?: string[] | string;
}) {
  const current = await getSponsorshipEmailAlertSettings();
  const nextEnabled = enabled === undefined ? current.enabled : enabled;
  const nextRecipients = recipients === undefined ? current.recipients : normalizeEmailList(recipients);

  if (nextRecipients.length === 0) {
    throw new Error("INVALID_SPONSORSHIP_EMAIL_RECIPIENTS");
  }

  await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values
        ($1, to_jsonb($2::boolean), now()),
        ($3, to_jsonb($4::text[]), now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
    `,
    [SPONSORSHIP_EMAIL_ALERTS_ENABLED_KEY, nextEnabled, SPONSORSHIP_EMAIL_ALERT_RECIPIENTS_KEY, nextRecipients]
  );

  return { enabled: nextEnabled, recipients: nextRecipients };
}

export async function getGmailIntelligenceSettings(): Promise<GmailIntelligenceSettings> {
  const result = await db.query(
    "select key, value from public.app_settings where key = any($1::text[])",
    [[GMAIL_INTELLIGENCE_SETTINGS_KEY, GMAIL_CLIENT_ID_KEY, GMAIL_CLIENT_SECRET_KEY, GMAIL_REFRESH_TOKEN_LUCAS_KEY, GMAIL_WEBHOOK_SECRET_KEY]]
  );
  const settings = new Map(result.rows.map((row) => [row.key, row.value]));
  const base = normalizeGmailSettings(settings.get(GMAIL_INTELLIGENCE_SETTINGS_KEY));

  return {
    ...base,
    webhookUrl: `${getAppUrl().replace(/\/$/, "")}/api/integrations/gmail/pubsub`,
    credentialsConfigured: {
      clientId: Boolean(normalizeText(settings.get(GMAIL_CLIENT_ID_KEY))),
      clientSecret: Boolean(normalizeText(settings.get(GMAIL_CLIENT_SECRET_KEY))),
      refreshTokenLucas: Boolean(normalizeText(settings.get(GMAIL_REFRESH_TOKEN_LUCAS_KEY))),
      webhookSecret: Boolean(normalizeText(settings.get(GMAIL_WEBHOOK_SECRET_KEY))),
    },
  };
}

export async function getGmailIntelligenceSecrets(): Promise<GmailIntelligenceSecrets> {
  const result = await db.query(
    "select key, value from public.app_settings where key = any($1::text[])",
    [[GMAIL_CLIENT_ID_KEY, GMAIL_CLIENT_SECRET_KEY, GMAIL_REFRESH_TOKEN_LUCAS_KEY, GMAIL_WEBHOOK_SECRET_KEY]]
  );
  const settings = new Map(result.rows.map((row) => [row.key, row.value]));

  return {
    clientId: normalizeText(settings.get(GMAIL_CLIENT_ID_KEY)),
    clientSecret: decryptSecret(settings.get(GMAIL_CLIENT_SECRET_KEY)),
    refreshTokenLucas: decryptSecret(settings.get(GMAIL_REFRESH_TOKEN_LUCAS_KEY)),
    webhookSecret: decryptSecret(settings.get(GMAIL_WEBHOOK_SECRET_KEY)),
  };
}

export async function setGmailIntelligenceSettings(input: GmailIntelligenceSettingsInput) {
  const current = await getGmailIntelligenceSettings();
  const next = normalizeGmailSettings({
    enabled: input.enabled === undefined ? current.enabled : input.enabled,
    monitoredMailbox: input.monitoredMailbox === undefined ? current.monitoredMailbox : input.monitoredMailbox,
    monitoredTargets: input.monitoredTargets === undefined ? current.monitoredTargets : input.monitoredTargets,
    strongKeywords: input.strongKeywords === undefined ? current.strongKeywords : input.strongKeywords,
    ignoredSenders: input.ignoredSenders === undefined ? current.ignoredSenders : input.ignoredSenders,
    importantSenders: input.importantSenders === undefined ? current.importantSenders : input.importantSenders,
    importantSenderColor: input.importantSenderColor === undefined ? current.importantSenderColor : input.importantSenderColor,
    googleCloudProjectId: input.googleCloudProjectId === undefined ? current.googleCloudProjectId : input.googleCloudProjectId,
    pubsubTopic: input.pubsubTopic === undefined ? current.pubsubTopic : input.pubsubTopic,
    pubsubSubscription: input.pubsubSubscription === undefined ? current.pubsubSubscription : input.pubsubSubscription,
    alertVisibility: input.alertVisibility === undefined ? current.alertVisibility : input.alertVisibility,
  });

  await db.query(
    `
      insert into public.app_settings (key, value, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
    `,
    [GMAIL_INTELLIGENCE_SETTINGS_KEY, JSON.stringify(next)]
  );

  const secretEntries: [string, string][] = [];
  const clientId = normalizeText(input.clientId);
  const clientSecret = normalizeText(input.clientSecret);
  const refreshTokenLucas = normalizeText(input.refreshTokenLucas);
  const webhookSecret = normalizeText(input.webhookSecret);

  if (clientId) secretEntries.push([GMAIL_CLIENT_ID_KEY, clientId]);
  if (clientSecret) secretEntries.push([GMAIL_CLIENT_SECRET_KEY, encryptSecret(clientSecret)]);
  if (refreshTokenLucas) secretEntries.push([GMAIL_REFRESH_TOKEN_LUCAS_KEY, encryptSecret(refreshTokenLucas)]);
  if (webhookSecret) secretEntries.push([GMAIL_WEBHOOK_SECRET_KEY, encryptSecret(webhookSecret)]);

  if (secretEntries.length > 0) {
    const values = secretEntries
      .map((_, index) => `($${index * 2 + 1}, to_jsonb($${index * 2 + 2}::text), now())`)
      .join(", ");
    const params = secretEntries.flatMap(([key, value]) => [key, value]);

    await db.query(
      `
        insert into public.app_settings (key, value, updated_at)
        values ${values}
        on conflict (key)
        do update set value = excluded.value, updated_at = now()
      `,
      params
    );
  }

  return getGmailIntelligenceSettings();
}
