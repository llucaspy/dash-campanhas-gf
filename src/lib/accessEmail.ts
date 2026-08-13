import { randomBytes } from "crypto";
import nodemailer from "nodemailer";

interface AccessEmailInput {
  name: string;
  username: string;
  password: string;
  appUrl: string;
}

interface SendAccessEmailInput extends AccessEmailInput {
  to: string;
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateTemporaryPassword(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://dashboardgf-llucaspaim.vercel.app";
}

export function renderAccessEmail({ name, username, password, appUrl }: AccessEmailInput) {
  const safeName = escapeHtml(name);
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(password);
  const safeAppUrl = escapeHtml(appUrl);

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Credenciais de acesso | Dashboard - Governo Federal</title>
  </head>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#1d1e2c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f4f7fb;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:100%;max-width:760px;background:#ffffff;border:1px solid #e2e8f3;border-radius:28px;box-shadow:0 24px 72px rgba(15,23,42,0.10);overflow:hidden;">
            <tr>
              <td style="background:#16214a;background-image:linear-gradient(135deg,#111827 0%,#203181 58%,#365dff 100%);padding:48px 52px 50px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <span style="display:inline-block;border:1px solid rgba(255,255,255,0.28);border-radius:999px;padding:8px 14px;color:#e7efff;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">
                        Dashboard - Governo Federal
                      </span>
                      <h1 style="margin:30px 0 12px;color:#ffffff;font-size:31px;line-height:1.2;font-weight:800;letter-spacing:-.02em;">Acesso liberado</h1>
                      <p style="margin:0;max-width:600px;color:#dce7ff;font-size:15px;line-height:1.75;font-weight:600;">
                        Suas credenciais para a plataforma interna de acompanhamento de campanhas est&atilde;o dispon&iacute;veis abaixo.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:42px 52px 10px;">
                <p style="margin:0 0 26px;color:#4f5b70;font-size:15px;line-height:1.85;">
                  Ol&aacute;, <strong style="color:#1d1e2c;">${safeName}</strong>. Este acesso &eacute; individual. Utilize os dados abaixo para entrar na plataforma.
                  No primeiro acesso, o sistema solicitar&aacute; a defini&ccedil;&atilde;o de uma nova senha pessoal.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f3;border-radius:22px;overflow:hidden;background:#fbfcff;">
                  <tr>
                    <td style="padding:22px 24px;border-bottom:1px solid #e8edf6;">
                      <div style="color:#98a2b7;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Usu&aacute;rio</div>
                      <div style="margin-top:10px;color:#1d1e2c;font-size:22px;line-height:1.35;font-weight:800;word-break:break-word;">${safeUsername}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 24px;">
                      <div style="color:#98a2b7;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Senha inicial</div>
                      <div style="margin-top:10px;color:#1d1e2c;font-size:22px;line-height:1.35;font-weight:800;font-family:Consolas,Menlo,Monaco,monospace;word-break:break-word;">${safePassword}</div>
                    </td>
                  </tr>
                </table>

                <div style="padding:34px 0 22px;text-align:center;">
                  <a href="${safeAppUrl}" style="display:inline-block;background:#355cff;color:#ffffff;text-decoration:none;border-radius:16px;padding:16px 32px;font-size:14px;font-weight:800;box-shadow:0 16px 34px rgba(53,92,255,0.24);">
                    Acessar plataforma
                  </a>
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #edf1f7;border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px;color:#647084;font-size:13px;line-height:1.75;">
                      Por seguran&ccedil;a, n&atilde;o compartilhe estas credenciais. Caso n&atilde;o reconhe&ccedil;a este convite, informe ao respons&aacute;vel pela plataforma.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 52px 44px;">
                <div style="border-top:1px solid #edf1f7;padding-top:22px;color:#98a1b3;font-size:12px;line-height:1.75;">
                  Caso o bot&atilde;o n&atilde;o abra, acesse:
                  <a href="${safeAppUrl}" style="color:#355cff;text-decoration:none;font-weight:800;">${safeAppUrl}</a><br />
                  Mensagem autom&aacute;tica de credenciamento interno.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Dashboard - Governo Federal",
    "",
    `Ola, ${name}.`,
    "",
    "Suas credenciais para a plataforma interna de acompanhamento de campanhas estao disponiveis abaixo.",
    "",
    `Link: ${appUrl}`,
    `Usuario: ${username}`,
    `Senha inicial: ${password}`,
    "",
    "No primeiro acesso, o sistema solicitara a definicao de uma nova senha pessoal.",
    "Este acesso e individual. Nao compartilhe suas credenciais.",
  ].join("\n");

  return { html, text };
}

export async function sendAccessEmail({ to, name, username, password, appUrl }: SendAccessEmailInput) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || (user ? `Dashboard - Governo Federal <${user}>` : undefined);

  if (!user || !pass || !from) {
    throw new Error("SMTP_USER, SMTP_PASS e SMTP_FROM precisam estar configurados.");
  }

  const { html, text } = renderAccessEmail({ name, username, password, appUrl });
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter.sendMail({
    from,
    to,
    subject: "Credenciais de acesso | Dashboard - Governo Federal",
    html,
    text,
  });
}
