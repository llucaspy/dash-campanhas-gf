const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("pg");
const { parseEnvFile } = require("./load-env-file.cjs");

const envFile = process.argv.find((arg) => arg.startsWith("--env-file="))?.split("=")[1];
if (envFile) Object.assign(process.env, parseEnvFile(envFile));

const downloadsDir = path.join(os.homedir(), "Downloads");
const tokenPath =
  process.argv.find((arg) => arg.startsWith("--token-file="))?.split("=")[1] ||
  path.join(downloadsDir, "gmail_token_lucas.local.json");
const clientSecretPath =
  process.argv.find((arg) => arg.startsWith("--client-secret-file="))?.split("=")[1] ||
  fs
    .readdirSync(downloadsDir)
    .filter((name) => /^client_secret_.*\.json$/.test(name))
    .map((name) => path.join(downloadsDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

function normalizeText(value) {
  return String(value || "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "")
    .trim();
}

function getEncryptionKey() {
  const source = normalizeText(process.env.GMAIL_ENCRYPTION_SECRET || process.env.AUTH_SECRET || "dev-only-change-this-gmail-secret");
  return crypto.createHash("sha256").update(source).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

function readJson(file, label) {
  if (!file || !fs.existsSync(file)) throw new Error(`${label} nao encontrado.`);
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

async function validateGmailCredentials({ clientId, clientSecret, refreshToken }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json().catch(() => ({}));

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Nao foi possivel validar o refresh token do Gmail.");
  }

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));

  if (!profileResponse.ok || !profile.emailAddress) {
    throw new Error(profile.error?.message || "Nao foi possivel validar o perfil Gmail.");
  }

  return profile.emailAddress;
}

async function main() {
  if (!connectionString) throw new Error("DATABASE_URL ou DIRECT_URL ausente.");

  const clientSecretJson = readJson(clientSecretPath, "Client Secret OAuth");
  const tokenJson = readJson(tokenPath, "Refresh token local");
  const webClient = clientSecretJson.web || clientSecretJson.installed || {};

  const clientId = normalizeText(webClient.client_id);
  const clientSecret = normalizeText(webClient.client_secret);
  const refreshToken = normalizeText(tokenJson.refresh_token);

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Client ID, Client Secret ou Refresh Token ausente nos arquivos locais.");
  }

  const profileEmail = await validateGmailCredentials({ clientId, clientSecret, refreshToken });
  const settings = {
    enabled: true,
    monitoredMailbox: "lucas.mendonca@metropoles.com",
    monitoredTargets: ["lucas.mendonca@metropoles.com", "opec.gov@metropoles.com", "Lucas", "OPEC"],
    strongKeywords: [
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
    ],
    ignoredSenders: ["noreply", "no-reply", "newsletter"],
    importantSenders: [
      "checking@metrike.com",
      "operacional@aheadserver.com.br",
      "suporte@adxspace.com.br",
      "suporte@brasiladserver.com",
      "joao@adforce.com.br",
      "suporte@vetta.net.br",
      "suporte@adserverstart.com",
    ],
    importantSenderColor: "#2563EB",
    googleCloudProjectId: normalizeText(clientSecretJson.project_id || webClient.project_id),
    pubsubTopic: "",
    pubsubSubscription: "",
    alertVisibility: "lucas_only",
  };

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(
      `
        insert into public.app_settings (key, value, updated_at)
        values
          ('gmail_intelligence_settings', $1::jsonb, now()),
          ('gmail_intelligence_client_id', to_jsonb($2::text), now()),
          ('gmail_intelligence_client_secret', to_jsonb($3::text), now()),
          ('gmail_intelligence_refresh_token_lucas', to_jsonb($4::text), now())
        on conflict (key)
        do update set value = excluded.value, updated_at = now()
      `,
      [JSON.stringify(settings), clientId, encryptSecret(clientSecret), encryptSecret(refreshToken)]
    );
  } finally {
    await client.end();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        enabled: true,
        mailbox: settings.monitoredMailbox,
        oauthProfile: profileEmail,
        monitoredTargets: settings.monitoredTargets,
        credentialsConfigured: {
          clientId: true,
          clientSecret: true,
          refreshTokenLucas: true,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`CONFIGURE_GMAIL_FAILED: ${error.message}`);
  process.exitCode = 1;
});
