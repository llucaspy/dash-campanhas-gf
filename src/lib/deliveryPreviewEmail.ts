import nodemailer from "nodemailer";
import type { Campaign } from "../context/CampaignContext";
import { splitCampaignsByArchive } from "./campaignArchive";
import { calculateTotalImpressions, getCampaignIntelligence } from "./campaignHealth";
import { getAppUrl } from "./accessEmail";

interface RankedCampaign {
  campaign: Campaign;
  total: number;
  delivered: number;
  deliveryPct: number;
  expectedPct: number;
  gap: number;
  va: number;
  isDeliveredPositive: boolean;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("pt-BR");
}

function formatPct(value: number, signed = false) {
  const rounded = Math.round(value);
  return `${signed && rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatGap(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} p.p.`;
}

function getMetricVisual() {
  return { accent: "#315f96", soft: "#f7faff", border: "#d8e4f2" };
}

function getTransportConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || (user ? `Dashboard - Governo Federal <${user}>` : undefined);

  if (!user || !pass || !from) {
    throw new Error("SMTP_USER, SMTP_PASS e SMTP_FROM precisam estar configurados.");
  }

  return { host, port, user, pass, from };
}

function getRankedCampaigns(campaigns: Campaign[]) {
  return campaigns
    .map((campaign) => {
      const intelligence = getCampaignIntelligence(campaign, { isAdmin: false });
      const pacing = intelligence.pacing;
      const total = calculateTotalImpressions(campaign);
      const delivered = campaign.deliveredImpressions || 0;
      const deliveryPct = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const expectedPct = pacing?.expectedPct ?? (deliveryPct >= 100 ? 100 : deliveryPct);
      const gap = deliveryPct - expectedPct;

      return {
        campaign,
        total,
        delivered,
        deliveryPct,
        expectedPct,
        gap,
        va: Number(campaign.viewabilityPercentage || 0),
        isDeliveredPositive: deliveryPct >= 100,
      };
    });
}

function isDeliveredPositiveCampaign(campaign: Campaign) {
  const total = calculateTotalImpressions(campaign);
  if (total <= 0) return false;
  return ((campaign.deliveredImpressions || 0) / total) * 100 >= 100;
}

function parseDateOnly(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function isWithinFlightPeriod(campaign: Campaign, today = new Date()) {
  const end = parseDateOnly(campaign.endDate);
  if (!end) return true;
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end.getTime() >= current.getTime();
}

function sortBestCampaigns(a: RankedCampaign, b: RankedCampaign) {
  if (a.isDeliveredPositive !== b.isDeliveredPositive) return a.isDeliveredPositive ? -1 : 1;
  return b.gap - a.gap || b.deliveryPct - a.deliveryPct || b.delivered - a.delivered;
}

function sortWatchCampaigns(a: RankedCampaign, b: RankedCampaign) {
  return a.gap - b.gap || a.deliveryPct - b.deliveryPct || b.total - a.total;
}

function metricCard(label: string, value: string, detail?: string) {
  const visual = getMetricVisual();

  return `
    <td class="metric-cell" width="50%" style="padding:0 8px 16px;">
      <table class="metric-card force-light" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffffe" style="border:1px solid ${visual.border};border-radius:18px;background:#fffffe;background-color:#fffffe;color:#263042;">
        <tr>
          <td style="padding:20px 20px 22px;">
            <table role="presentation" cellspacing="0" cellpadding="0" bgcolor="${visual.soft}" style="margin-bottom:12px;background:${visual.soft};background-color:${visual.soft};border:1px solid ${visual.border};border-radius:999px;">
              <tr>
                <td style="padding:6px 0 6px 10px;">
                  <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="10" height="10" bgcolor="${visual.accent}" style="width:10px;height:10px;border-radius:999px;background:${visual.accent};background-color:${visual.accent};font-size:0;line-height:10px;">&nbsp;</td>
                      <td class="muted-text" style="padding-left:8px;padding-right:10px;color:#667085;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(label)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div class="strong-text" style="color:#263042;font-size:25px;line-height:1.12;font-weight:700;">${escapeHtml(value)}</div>
            ${detail ? `<div class="muted-text" style="margin-top:8px;color:#667085;font-size:13px;line-height:1.45;font-weight:500;">${escapeHtml(detail)}</div>` : ""}
          </td>
        </tr>
      </table>
    </td>`;
}

function campaignRow(item: RankedCampaign, tone: "positive" | "watch") {
  const color = tone === "positive" ? "#047857" : "#b45309";
  const accent = tone === "positive" ? "#10b981" : "#f59e0b";
  const bg = tone === "positive" ? "#ecfdf5" : "#fff7ed";
  const border = tone === "positive" ? "#bbf7d0" : "#fed7aa";
  const rowBg = tone === "positive" ? "#fbfefc" : "#fffdf8";
  const name = item.campaign.campaignName || "Campanha sem nome";
  const pi = item.campaign.piNumber ? `PI ${item.campaign.piNumber}` : "PI nao informado";

  return `
    <tr>
      <td style="padding:22px 0;border-top:1px solid #e8eef7;">
        <table class="campaign-panel campaign-panel-${tone}" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${rowBg}" style="background:${rowBg};background-color:${rowBg};border:1px solid ${border};border-radius:18px;color:#263042;">
          <tr>
            <td style="padding:18px 18px 0;border-left:4px solid ${accent};border-radius:18px 0 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-right:14px;">
                    <div class="strong-text" style="color:#263042;font-size:14px;line-height:1.5;font-weight:700;text-transform:uppercase;">${escapeHtml(name)}</div>
                    <div class="muted-text" style="margin-top:6px;color:#667085;font-size:13px;line-height:1.55;font-weight:500;">${escapeHtml(pi)} &middot; ${escapeHtml(item.campaign.client || "Cliente nao informado")}</div>
                  </td>
                  <td class="gap-cell" align="right" width="128" style="vertical-align:top;">
                    <span style="display:inline-block;border:1px solid ${border};border-radius:999px;background:${bg};background-color:${bg};color:${color};padding:8px 12px;font-size:12px;font-weight:700;">${escapeHtml(formatGap(item.gap))}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 18px 18px;border-left:4px solid ${accent};border-radius:0 0 0 18px;">
              <table class="campaign-stats force-light" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffffe" style="background:#fffffe;background-color:#fffffe;border:1px solid #e5ebf4;border-radius:14px;color:#263042;">
                <tr>
                  <td class="stat-cell" width="50%" style="padding:15px 17px;border-right:1px solid #edf1f7;border-bottom:1px solid #edf1f7;">
                    <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">Contratado</div>
                    <div class="strong-text" style="margin-top:6px;color:#263042;font-size:16px;font-weight:700;">${escapeHtml(formatNumber(item.total))}</div>
                  </td>
                  <td class="stat-cell" width="50%" style="padding:15px 17px;border-bottom:1px solid #edf1f7;">
                    <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">Entregue</div>
                    <div class="strong-text" style="margin-top:6px;color:#263042;font-size:16px;font-weight:700;">${escapeHtml(formatNumber(item.delivered))}</div>
                  </td>
                </tr>
                <tr>
                  <td class="stat-cell" width="50%" style="padding:15px 17px;border-right:1px solid #edf1f7;">
                    <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">VA</div>
                    <div class="strong-text" style="margin-top:6px;color:#263042;font-size:16px;font-weight:700;">${escapeHtml(formatPct(item.va))}</div>
                  </td>
                  <td class="stat-cell" width="50%" style="padding:15px 17px;">
                    <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">Ritmo</div>
                    <div class="strong-text" style="margin-top:6px;color:#263042;font-size:16px;font-weight:700;">${escapeHtml(formatPct(item.deliveryPct))} / ${escapeHtml(formatPct(item.expectedPct))}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function buildDeliveryPreview(campaigns: Campaign[]) {
  const { currentCampaigns } = splitCampaignsByArchive(campaigns);
  const currentCampaignIds = new Set(currentCampaigns.map((campaign) => campaign.id));
  const reportCampaigns = campaigns.filter((campaign) => {
    const isCurrentCampaign = currentCampaignIds.has(campaign.id) && campaign.status !== "finalizada";
    const isDeliveredWithinPeriod = isDeliveredPositiveCampaign(campaign) && isWithinFlightPeriod(campaign);
    return isCurrentCampaign || isDeliveredWithinPeriod;
  });
  const ranked = getRankedCampaigns(reportCampaigns);
  const totalAim = ranked.reduce((sum, item) => sum + item.total, 0);
  const totalDelivered = ranked.reduce((sum, item) => sum + item.delivered, 0);
  const expectedWeighted = ranked.reduce((sum, item) => sum + item.total * item.expectedPct, 0);
  const vaWeighted = ranked.reduce((sum, item) => sum + item.total * item.va, 0);
  const deliveryPct = totalAim > 0 ? Math.round((totalDelivered / totalAim) * 100) : 0;
  const expectedPct = totalAim > 0 ? Math.round(expectedWeighted / totalAim) : 0;
  const vaPct = totalAim > 0 ? Math.round(vaWeighted / totalAim) : 0;
  const gap = deliveryPct - expectedPct;
  const positiveCandidates = ranked.filter((item) => item.isDeliveredPositive || item.gap >= 0);
  const best = [...positiveCandidates].sort(sortBestCampaigns);
  const bestIds = new Set(best.map((item) => item.campaign.id));
  const watchCandidates = ranked.filter((item) => !bestIds.has(item.campaign.id));
  const watch = [...watchCandidates].sort(sortWatchCampaigns);
  const watchTone: "positive" | "watch" = "watch";
  const watchTitle = "Em acompanhamento";
  const watchEmptyMessage = "Sem campanhas em acompanhamento neste recorte.";

  return {
    activeCampaigns: reportCampaigns,
    ranked,
    best,
    watch,
    watchTone,
    watchTitle,
    watchEmptyMessage,
    metrics: {
      activeCount: reportCampaigns.length,
      totalAim,
      totalDelivered,
      deliveryPct,
      expectedPct,
      gap,
      vaPct,
    },
  };
}

export function renderDeliveryPreviewEmail(campaigns: Campaign[]) {
  const preview = buildDeliveryPreview(campaigns);
  const appUrl = getAppUrl();
  const generatedAt = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Relatorio Preview das Entregas</title>
    <style>
      :root {
        color-scheme: light;
        supported-color-schemes: light;
      }

      .email-body,
      .email-bg {
        background: #eef3fb !important;
        background-color: #eef3fb !important;
        color: #263042 !important;
      }

      .force-light,
      .email-shell,
      .metric-card,
      .campaign-stats {
        background: #fffffe !important;
        background-color: #fffffe !important;
        color: #263042 !important;
      }

      .campaign-panel-positive {
        background: #fbfefc !important;
        background-color: #fbfefc !important;
        color: #263042 !important;
      }

      .campaign-panel-watch {
        background: #fffdf8 !important;
        background-color: #fffdf8 !important;
        color: #263042 !important;
      }

      .soft-section {
        background: #f7faff !important;
        background-color: #f7faff !important;
      }

      .strong-text {
        color: #263042 !important;
      }

      .muted-text {
        color: #667085 !important;
      }

      @media (prefers-color-scheme: dark) {
        .email-body,
        .email-bg {
          background: #eef3fb !important;
          background-color: #eef3fb !important;
          color: #263042 !important;
        }

        .force-light,
        .email-shell,
        .metric-card,
        .campaign-stats {
          background: #fffffe !important;
          background-color: #fffffe !important;
          color: #263042 !important;
        }

        .campaign-panel-positive {
          background: #fbfefc !important;
          background-color: #fbfefc !important;
          color: #263042 !important;
        }

        .campaign-panel-watch {
          background: #fffdf8 !important;
          background-color: #fffdf8 !important;
          color: #263042 !important;
        }

        .soft-section {
          background: #f7faff !important;
          background-color: #f7faff !important;
        }

        .strong-text {
          color: #263042 !important;
        }

        .muted-text {
          color: #667085 !important;
        }
      }

      [data-ogsc] .email-body,
      [data-ogsc] .email-bg {
        background: #eef3fb !important;
        background-color: #eef3fb !important;
      }

      [data-ogsc] .force-light,
      [data-ogsc] .email-shell,
      [data-ogsc] .metric-card,
      [data-ogsc] .campaign-stats {
        background: #fffffe !important;
        background-color: #fffffe !important;
        color: #263042 !important;
      }

      [data-ogsc] .campaign-panel-positive {
        background: #fbfefc !important;
        background-color: #fbfefc !important;
        color: #263042 !important;
      }

      [data-ogsc] .campaign-panel-watch {
        background: #fffdf8 !important;
        background-color: #fffdf8 !important;
        color: #263042 !important;
      }

      @media only screen and (max-width: 640px) {
        .outer-pad {
          padding: 24px 10px !important;
        }

        .email-shell {
          width: 100% !important;
          max-width: 100% !important;
          border-radius: 18px !important;
        }

        .section-pad {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }

        .metric-cell {
          display: block !important;
          width: 100% !important;
          padding: 0 0 12px !important;
        }

        .stat-cell {
          display: block !important;
          width: 100% !important;
          border-right: 0 !important;
          border-bottom: 1px solid #edf1f7 !important;
          box-sizing: border-box !important;
        }

        .gap-cell {
          display: block !important;
          width: 100% !important;
          padding-top: 12px !important;
          text-align: left !important;
        }

        .email-title {
          font-size: 24px !important;
        }
      }
    </style>
  </head>
  <body class="email-body" bgcolor="#eef3fb" style="margin:0;background:#eef3fb;background-color:#eef3fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#263042;">
    <table class="email-bg outer-pad" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eef3fb" style="width:100%;background:#eef3fb;background-color:#eef3fb;padding:46px 18px;color:#263042;">
      <tr>
        <td align="center">
          <table class="email-shell force-light" role="presentation" width="820" cellspacing="0" cellpadding="0" bgcolor="#fffffe" style="width:100%;max-width:820px;background:#fffffe;background-color:#fffffe;border:1px solid #d6e0ef;border-radius:28px;overflow:hidden;color:#263042;">
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td height="5" width="100%" bgcolor="#315f96" style="height:5px;background:#315f96;background-color:#315f96;font-size:0;line-height:5px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="soft-section section-pad" bgcolor="#f7faff" style="padding:38px 42px 32px;background:#f7faff;background-color:#f7faff;border-bottom:1px solid #edf1f7;color:#263042;">
                <div style="display:inline-block;border:1px solid #d8e4f2;border-radius:999px;padding:8px 13px;color:#315f96;background:#fffffe;background-color:#fffffe;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Dashboard Governo Federal</div>
                <h1 class="email-title strong-text" style="margin:22px 0 10px;color:#263042;font-size:29px;line-height:1.18;font-weight:700;">Relat&oacute;rio Preview das Entregas</h1>
                <p class="muted-text" style="margin:0;color:#667085;font-size:14px;line-height:1.65;font-weight:500;">Atualizado em ${escapeHtml(generatedAt)}</p>
              </td>
            </tr>
            <tr>
              <td class="section-pad" style="padding:34px 34px 10px;background:#fffffe;background-color:#fffffe;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    ${metricCard("Campanhas", String(preview.metrics.activeCount), "consideradas")}
                    ${metricCard("Contratado", formatNumber(preview.metrics.totalAim), "impressoes")}
                  </tr>
                  <tr>
                    ${metricCard("Entregue", formatNumber(preview.metrics.totalDelivered), `${formatPct(preview.metrics.deliveryPct)} realizado`)}
                    ${metricCard("VA", formatPct(preview.metrics.vaPct), `ritmo ${formatPct(preview.metrics.expectedPct)} esperado`)}
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="section-pad" style="padding:18px 42px 8px;background:#fffffe;background-color:#fffffe;">
                <h2 class="strong-text" style="margin:0;color:#263042;font-size:18px;line-height:1.35;font-weight:700;">Melhores desempenhos</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:4px;">
                  ${preview.best.map((item) => campaignRow(item, "positive")).join("") || `<tr><td class="muted-text" style="padding:18px 0;color:#5f6b7d;font-size:13px;border-top:1px solid #edf1f7;">Sem campanhas positivas neste recorte.</td></tr>`}
                </table>
              </td>
            </tr>
            <tr>
              <td class="section-pad" style="padding:24px 42px 10px;background:#fffffe;background-color:#fffffe;">
                <h2 class="strong-text" style="margin:0;color:#263042;font-size:18px;line-height:1.35;font-weight:700;">${escapeHtml(preview.watchTitle)}</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:4px;">
                  ${preview.watch.map((item) => campaignRow(item, preview.watchTone)).join("") || `<tr><td class="muted-text" style="padding:18px 0;color:#5f6b7d;font-size:13px;border-top:1px solid #edf1f7;">${escapeHtml(preview.watchEmptyMessage)}</td></tr>`}
                </table>
              </td>
            </tr>
            <tr>
              <td class="section-pad soft-section" bgcolor="#f7faff" style="padding:32px 42px 40px;background:#f7faff;background-color:#f7faff;border-top:1px solid #edf1f7;">
                <p class="muted-text" style="margin:0 0 18px;color:#667085;font-size:14px;line-height:1.65;font-weight:500;">Para acompanhar todas as entregas, acesse a plataforma.</p>
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#2563eb;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:14px;padding:15px 26px;font-size:14px;font-weight:700;">Acessar acompanhamento completo</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const lines = [
    "Relatorio Preview das Entregas",
    `Atualizado em ${generatedAt}`,
    "",
    `Campanhas consideradas: ${preview.metrics.activeCount}`,
    `Contratado: ${formatNumber(preview.metrics.totalAim)}`,
    `Entregue: ${formatNumber(preview.metrics.totalDelivered)} (${formatPct(preview.metrics.deliveryPct)})`,
    `VA: ${formatPct(preview.metrics.vaPct)}`,
    `Ritmo esperado: ${formatPct(preview.metrics.expectedPct)}`,
    "",
    "Melhores desempenhos",
    ...preview.best.map((item, index) => `${index + 1}. ${item.campaign.campaignName} | contratado ${formatNumber(item.total)} | entregue ${formatNumber(item.delivered)} (${formatPct(item.deliveryPct)}) | VA ${formatPct(item.va)} | ritmo esperado ${formatPct(item.expectedPct)} | ${formatGap(item.gap)}`),
    "",
    preview.watchTitle,
    ...(preview.watch.length > 0
      ? preview.watch.map((item, index) => `${index + 1}. ${item.campaign.campaignName} | contratado ${formatNumber(item.total)} | entregue ${formatNumber(item.delivered)} (${formatPct(item.deliveryPct)}) | VA ${formatPct(item.va)} | ritmo esperado ${formatPct(item.expectedPct)} | ${formatGap(item.gap)}`)
      : [preview.watchEmptyMessage]),
    "",
    `Acessar acompanhamento completo: ${appUrl}`,
  ];

  return { html, text: lines.join("\n"), preview };
}

export async function sendDeliveryPreviewEmail({ to, campaigns, subjectPrefix = "" }: { to: string[]; campaigns: Campaign[]; subjectPrefix?: string }) {
  const { host, port, user, pass, from } = getTransportConfig();
  const { html, text, preview } = renderDeliveryPreviewEmail(campaigns);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject: `${subjectPrefix}Relatorio Preview das Entregas`,
    html,
    text,
  });

  return { info, preview };
}
