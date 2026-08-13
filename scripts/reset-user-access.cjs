const { randomBytes, pbkdf2Sync } = require("crypto");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");
const { parseEnvFile } = require("./load-env-file.cjs");

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function generateTemporaryPassword(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2:${ITERATIONS}:${salt}:${hash}`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function renderEmail({ name, username, password, appUrl }) {
  const text = [
    "Dashboard - Governo Federal",
    "",
    `Ola, ${name}.`,
    "",
    "Seu acesso foi redefinido. Use os dados abaixo para entrar e criar uma nova senha pessoal.",
    "",
    `Link: ${appUrl}`,
    `Usuario: ${username}`,
    `Senha temporaria: ${password}`,
    "",
    "Se voce nao solicitou essa redefinicao, avise o responsavel pela plataforma.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1d1e2c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;background:#fff;border:1px solid #e2e8f3;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:34px 38px;background:#fbfcff;border-bottom:1px solid #edf1f7;">
                <div style="display:inline-block;border:1px solid #d9e3ff;border-radius:999px;padding:7px 12px;color:#355cff;background:#f6f9ff;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Dashboard - Governo Federal</div>
                <h1 style="margin:20px 0 8px;font-size:24px;line-height:1.25;">Acesso redefinido</h1>
                <p style="margin:0;color:#647084;font-size:14px;line-height:1.7;">Use a senha temporária abaixo para entrar. No primeiro acesso, o sistema pedirá uma nova senha pessoal.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 38px;">
                <p style="margin:0 0 18px;color:#4f5b70;font-size:14px;line-height:1.7;">Olá, <strong>${name}</strong>.</p>
                <div style="border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;background:#fbfcff;">
                  <div style="padding:18px 20px;border-bottom:1px solid #e8edf6;">
                    <div style="color:#98a2b7;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Usuário</div>
                    <div style="margin-top:8px;font-size:20px;font-weight:800;">${username}</div>
                  </div>
                  <div style="padding:18px 20px;">
                    <div style="color:#98a2b7;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Senha temporária</div>
                    <div style="margin-top:8px;font-size:20px;font-weight:800;font-family:Consolas,monospace;">${password}</div>
                  </div>
                </div>
                <div style="padding-top:28px;text-align:center;">
                  <a href="${appUrl}" style="display:inline-block;background:#355cff;color:white;text-decoration:none;border-radius:14px;padding:14px 24px;font-size:13px;font-weight:800;">Acessar plataforma</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

async function main() {
  const envFileArgIndex = process.argv.indexOf("--env-file");
  if (envFileArgIndex !== -1 && process.argv[envFileArgIndex + 1]) {
    Object.assign(process.env, parseEnvFile(process.argv[envFileArgIndex + 1]));
  }

  const skipEmail = process.argv.includes("--no-email");
  const target = process.argv.find((arg, index) => index > 1 && process.argv[index - 1] !== "--env-file" && arg !== "--env-file");
  if (!target) throw new Error("Usage: node scripts/reset-user-access.cjs <username-or-email>");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
  });

  const temporaryPassword = generateTemporaryPassword();
  const result = await pool.query(
    `
      update public.app_users
      set password_hash = $1,
          must_change_password = true,
          has_seen_welcome = false,
          active = true,
          updated_at = now()
      where lower(username) = lower($2) or lower(email) = lower($2)
      returning id, name, username, email
    `,
    [hashPassword(temporaryPassword), target.trim()]
  );

  await pool.end();

  const user = result.rows[0];
  if (!user) throw new Error("User not found");

  if (skipEmail) {
    console.log(
      JSON.stringify({
        ok: true,
        username: user.username,
        email: user.email,
        temporaryPassword,
        emailSkipped: true,
      })
    );
    return;
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = requireEnv("SMTP_USER");
  const smtpPass = requireEnv("SMTP_PASS");
  const smtpFrom = process.env.SMTP_FROM || `Dashboard - Governo Federal <${smtpUser}>`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://dashboardgf-llucaspaim.vercel.app";
  const { html, text } = renderEmail({
    name: user.name,
    username: user.username,
    password: temporaryPassword,
    appUrl,
  });

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const info = await transporter.sendMail({
    from: smtpFrom,
    to: user.email,
    subject: "Acesso redefinido | Dashboard - Governo Federal",
    html,
    text,
  });

  console.log(
    JSON.stringify({
      ok: true,
      username: user.username,
      email: user.email,
      accepted: info.accepted,
      rejected: info.rejected,
    })
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, code: error.code }));
  process.exitCode = 1;
});
