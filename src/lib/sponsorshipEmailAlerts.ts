import nodemailer from "nodemailer";
import { getAppUrl } from "./accessEmail";
import type { Campaign } from "../context/CampaignContext";
import { calculateTotalImpressions, getCampaignPacing } from "./campaignHealth";
import { CAMPAIGN_BOOST_STATUS_LABELS, getEffectiveCampaignBoostStatus, type CampaignBoostStatus } from "./campaignOperationalStatus";

export interface OperationalEmailCampaign {
  campaign: Campaign;
  boostStatus: CampaignBoostStatus;
  severity: "critical" | "attention" | "watch";
  headline: string;
  reasons: string[];
  recommendation: string;
  total: number;
  delivered: number;
  deliveryPct: number;
  expectedPct: number;
  gap: number;
  daysLeft: number | null;
  hoursInStatus: number | null;
  lastMetricUpdatedAt: string | null;
  lastMetricLabel: string;
  va: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function formatNumber(value: number) {
  return Math.round(value || 0).toLocaleString("pt-BR");
}

function formatPct(value: number, signed = false) {
  const rounded = Math.round(value || 0);
  return `${signed && rounded > 0 ? "+" : ""}${rounded}%`;
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

function dateOnly(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function diffDays(start: Date, end: Date) {
  return Math.ceil((dateOnly(end).getTime() - dateOnly(start).getTime()) / (1000 * 3600 * 24));
}

function getHoursSince(value?: string | Date | null, today = new Date()) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (today.getTime() - date.getTime()) / (1000 * 3600));
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Sem atualizacao registrada";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atualizacao registrada";

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithinFlightPeriod(campaign: Campaign, today = new Date()) {
  if (campaign.status === "finalizada") return false;
  const end = parseDateOnly(campaign.endDate);
  if (!end) return true;
  return end.getTime() >= dateOnly(today).getTime();
}

function getSeverityRank(severity: OperationalEmailCampaign["severity"]) {
  if (severity === "critical") return 0;
  if (severity === "attention") return 1;
  return 2;
}

function getBoostRank(boostStatus: CampaignBoostStatus) {
  if (boostStatus === "sponsorship") return 0;
  if (boostStatus === "high") return 1;
  if (boostStatus === "normal") return 2;
  return 3;
}

export function buildOperationalEmailCampaigns(campaigns: Campaign[], today = new Date()): OperationalEmailCampaign[] {
  return campaigns
    .filter((campaign) => isWithinFlightPeriod(campaign, today))
    .map((campaign) => {
      const boostStatus = getEffectiveCampaignBoostStatus(campaign.status, campaign.boostStatus);
      const total = calculateTotalImpressions(campaign);
      const delivered = campaign.deliveredImpressions || 0;
      const deliveryPct = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const pacing = campaign.status === "veiculando" ? getCampaignPacing(campaign, today) : null;
      const expectedPct = pacing?.expectedPct ?? (deliveryPct >= 100 ? 100 : deliveryPct);
      const gap = deliveryPct - expectedPct;
      const end = parseDateOnly(campaign.endDate);
      const daysLeft = end ? diffDays(today, end) : null;
      const hoursInStatus = boostStatus === "sponsorship" ? getHoursSince(campaign.boostStatusUpdatedAt || campaign.createdAt, today) : null;
      const lastMetricUpdatedAt = campaign.metricHistory?.[0]?.recordedAt || null;
      const lastMetricLabel = formatDateTime(lastMetricUpdatedAt);
      const va = Number(campaign.viewabilityPercentage || 0);
      const reasons: string[] = [];
      let severity: OperationalEmailCampaign["severity"] = "watch";
      let headline = "Verificacao sugerida";
      let recommendation = "Abrir a campanha no dashboard e validar se a leitura de entrega esta coerente.";

      if (boostStatus === "sponsorship") {
        severity = "critical";
        headline = "Sponsorship ativo";
        reasons.push(
          hoursInStatus !== null
            ? `Marcada como Sponsorship ha ${Math.floor(hoursInStatus)}h.`
            : "Marcada como Sponsorship."
        );
        recommendation = "Conferir GAM, limite de entrega, ritmo e risco de overdelivery antes de seguir com a veiculacao.";
      }

      if (campaign.status === "pausada") {
        severity = severity === "critical" ? severity : "attention";
        headline = boostStatus === "sponsorship" ? headline : "Campanha pausada";
        reasons.push("Status pausado no dashboard.");
        recommendation = "Confirmar se a pausa ainda e intencional ou se a campanha deve ser retomada.";
      }

      if (boostStatus === "high") {
        severity = severity === "critical" ? severity : "attention";
        if (headline === "Verificacao sugerida") headline = "Padrao - Alta";
        reasons.push("Marcada manualmente como Padrao - Alta.");
        recommendation = "Revisar prioridade, ritmo e proximos passos operacionais antes de tratar campanhas de menor criticidade.";
      }

      if (total > 0 && deliveryPct >= 110) {
        severity = "critical";
        headline = "Overdelivery em andamento";
        reasons.push(`${formatPct(deliveryPct)} entregue contra ${formatNumber(total)} impressoes contratadas.`);
        recommendation = "Validar se a campanha deve reduzir ritmo, pausar entrega ou ajustar inventario.";
      } else if (total > 0 && deliveryPct >= 100 && daysLeft !== null && daysLeft >= 0) {
        severity = severity === "critical" ? severity : "attention";
        reasons.push(`${formatPct(deliveryPct)} entregue e ainda dentro do periodo de veiculacao.`);
      }

      if (pacing && gap <= -8) {
        const severeGap = gap <= -20 || (daysLeft !== null && daysLeft <= 3);
        severity = severeGap ? "critical" : severity === "critical" ? "critical" : "attention";
        if (headline === "Verificacao sugerida") headline = severeGap ? "Ritmo abaixo do esperado" : "Acompanhar ritmo";
        reasons.push(`Entrega em ${formatPct(deliveryPct)} vs ${formatPct(expectedPct)} esperado (${formatPct(gap, true)} de gap).`);
        recommendation = "Verificar inventario, segmentacao e leitura do adserver antes de esperar a proxima atualizacao.";
      }

      if (pacing && delivered <= 0 && pacing.passedDuration >= 1) {
        severity = "critical";
        headline = "Sem entrega registrada";
        reasons.push("Campanha ja iniciou e ainda nao tem impressoes entregues.");
        recommendation = "Conferir setup, status no GAM e se a campanha esta apta a servir.";
      }

      if (va > 0 && va < 50 && delivered > 0) {
        severity = severity === "critical" ? severity : "attention";
        reasons.push(`VA em ${formatPct(va)}, abaixo de 50%.`);
        if (headline === "Verificacao sugerida") headline = "Viewability baixa";
      }

      const manualLowWithoutRisk = boostStatus === "low" && reasons.length === 0;
      const normalWithoutRisk = boostStatus === "normal" && reasons.length === 0;
      if (manualLowWithoutRisk || normalWithoutRisk) return null;

      return {
        campaign,
        boostStatus,
        severity,
        headline,
        reasons,
        recommendation,
        total,
        delivered,
        deliveryPct,
        expectedPct,
        gap,
        daysLeft,
        hoursInStatus,
        lastMetricUpdatedAt,
        lastMetricLabel,
        va,
      };
    })
    .filter((item): item is OperationalEmailCampaign => Boolean(item))
    .sort((a, b) => {
      return (
        getSeverityRank(a.severity) - getSeverityRank(b.severity) ||
        getBoostRank(a.boostStatus) - getBoostRank(b.boostStatus) ||
        a.gap - b.gap ||
        b.deliveryPct - a.deliveryPct
      );
    });
}

export function renderSponsorshipAlertEmail(campaigns: OperationalEmailCampaign[]) {
  const appUrl = getAppUrl();
  const rows = campaigns
    .map((item) => {
      const campaign = item.campaign;
      const safeCampaign = escapeHtml(campaign.campaignName || "Campanha sem nome");
      const safePi = escapeHtml(campaign.piNumber || "-");
      const safeDashboard = campaign.dashLink ? escapeHtml(campaign.dashLink) : "";
      const safeGam = campaign.gamLink ? escapeHtml(campaign.gamLink) : "";
      const safeStatus = escapeHtml(CAMPAIGN_BOOST_STATUS_LABELS[item.boostStatus]);
      const severityColor = item.severity === "critical" ? "#b42318" : item.severity === "attention" ? "#b45309" : "#315f96";
      const severityBg = item.severity === "critical" ? "#fff1f1" : item.severity === "attention" ? "#fff7ed" : "#eef5ff";
      const severityBorder = item.severity === "critical" ? "#fecaca" : item.severity === "attention" ? "#fed7aa" : "#d8e4f2";
      const evidence = item.reasons
        .map((reason) => `<li style="margin:0 0 6px;color:#4b5565;font-size:13px;line-height:1.55;">${escapeHtml(reason)}</li>`)
        .join("");
      const daysLabel = item.daysLeft === null ? "-" : item.daysLeft < 0 ? "encerrada" : `${item.daysLeft}d`;

      return `
        <tr>
          <td style="padding:10px 0;">
            <table class="sponsorship-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffefa" style="width:100%;background:#fffefa;background-color:#fffefa;border:1px solid #eadcc7;border-radius:18px;color:#263042;">
              <tr>
                <td style="padding:18px 18px 16px;border-left:4px solid #d6a14a;border-radius:18px 0 0 18px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding-right:14px;">
                        <div class="strong-text" style="font-size:14px;line-height:1.5;font-weight:700;color:#263042;text-transform:uppercase;">${safeCampaign}</div>
                        <div class="muted-text" style="margin-top:6px;font-size:13px;line-height:1.6;color:#667085;font-weight:500;">PI ${safePi} &middot; ${escapeHtml(campaign.client || "Cliente nao informado")} &middot; ${safeStatus}</div>
                      </td>
                      <td class="status-cell" align="right" width="142" style="vertical-align:top;">
                        <span style="display:inline-block;border:1px solid ${severityBorder};border-radius:999px;background:${severityBg};background-color:${severityBg};color:${severityColor};padding:8px 12px;font-size:12px;font-weight:700;">${escapeHtml(item.headline)}</span>
                      </td>
                    </tr>
                  </table>
                  <table class="campaign-stats force-light" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffffe" style="margin-top:14px;background:#fffffe;background-color:#fffffe;border:1px solid #e5ebf4;border-radius:14px;color:#263042;">
                    <tr>
                      <td style="padding:13px 14px;border-right:1px solid #edf1f7;border-bottom:1px solid #edf1f7;">
                        <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">Contratado</div>
                        <div class="strong-text" style="margin-top:5px;color:#263042;font-size:15px;font-weight:700;">${escapeHtml(formatNumber(item.total))}</div>
                      </td>
                      <td style="padding:13px 14px;border-bottom:1px solid #edf1f7;">
                        <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">Entregue</div>
                        <div class="strong-text" style="margin-top:5px;color:#263042;font-size:15px;font-weight:700;">${escapeHtml(formatNumber(item.delivered))} (${escapeHtml(formatPct(item.deliveryPct))})</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:13px 14px;border-right:1px solid #edf1f7;">
                        <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">Ritmo</div>
                        <div class="strong-text" style="margin-top:5px;color:#263042;font-size:15px;font-weight:700;">${escapeHtml(formatPct(item.deliveryPct))} / ${escapeHtml(formatPct(item.expectedPct))}</div>
                      </td>
                      <td style="padding:13px 14px;">
                        <div class="muted-text" style="color:#7b8496;font-size:10px;font-weight:700;text-transform:uppercase;">VA / prazo</div>
                        <div class="strong-text" style="margin-top:5px;color:#263042;font-size:15px;font-weight:700;">${escapeHtml(formatPct(item.va))} &middot; ${escapeHtml(daysLabel)}</div>
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:10px;color:#667085;font-size:12px;line-height:1.55;font-weight:700;">
                    Referencia de dados: ultima atualizacao de metrica em ${escapeHtml(item.lastMetricLabel)}
                  </div>
                  <div style="margin-top:14px;">
                    <div class="strong-text" style="color:#263042;font-size:13px;font-weight:700;">Evidencias</div>
                    <ul style="margin:8px 0 0 18px;padding:0;">${evidence}</ul>
                  </div>
                  <div style="margin-top:12px;border:1px solid #d8e4f2;border-radius:14px;background:#f7faff;background-color:#f7faff;padding:12px 14px;color:#315f96;font-size:13px;line-height:1.55;font-weight:700;">
                    ${escapeHtml(item.recommendation)}
                  </div>
            ${
              safeDashboard || safeGam
                ? `<div style="margin-top:14px;font-size:12px;line-height:1.7;">
                    ${safeDashboard ? `<a href="${safeDashboard}" style="display:inline-block;border:1px solid #d8e4f2;border-radius:999px;background:#fffffe;background-color:#fffffe;color:#315f96;text-decoration:none;font-weight:700;padding:7px 11px;margin-right:6px;">Dashboard</a>` : ""}
                    ${safeGam ? `<a href="${safeGam}" style="display:inline-block;border:1px solid #d8e4f2;border-radius:999px;background:#fffffe;background-color:#fffffe;color:#315f96;text-decoration:none;font-weight:700;padding:7px 11px;">GAM</a>` : ""}
                  </div>`
                : ""
            }
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Alerta operacional de campanhas</title>
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
      .campaign-stats {
        background: #fffffe !important;
        background-color: #fffffe !important;
        color: #263042 !important;
      }

      .soft-section {
        background: #f7faff !important;
        background-color: #f7faff !important;
      }

      .sponsorship-card {
        background: #fffefa !important;
        background-color: #fffefa !important;
        color: #263042 !important;
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
        .campaign-stats {
          background: #fffffe !important;
          background-color: #fffffe !important;
          color: #263042 !important;
        }

        .soft-section {
          background: #f7faff !important;
          background-color: #f7faff !important;
        }

        .sponsorship-card {
          background: #fffefa !important;
          background-color: #fffefa !important;
          color: #263042 !important;
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
      [data-ogsc] .campaign-stats {
        background: #fffffe !important;
        background-color: #fffffe !important;
        color: #263042 !important;
      }

      [data-ogsc] .sponsorship-card {
        background: #fffefa !important;
        background-color: #fffefa !important;
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

        .status-cell {
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
                <div style="display:inline-block;border:1px solid #d8e4f2;border-radius:999px;padding:8px 13px;color:#315f96;background:#fffffe;background-color:#fffffe;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
                  Mesa OPEC
                </div>
                <h1 class="email-title strong-text" style="margin:22px 0 10px;color:#263042;font-size:29px;line-height:1.18;font-weight:700;">Alerta operacional de campanhas</h1>
                <p class="muted-text" style="margin:0;color:#667085;font-size:14px;line-height:1.65;font-weight:500;">
                  Campanhas selecionadas por sinais objetivos de status, m&eacute;trica e ritmo. Cada item traz a evid&ecirc;ncia e a pr&oacute;xima verifica&ccedil;&atilde;o recomendada.
                </p>
              </td>
            </tr>
            <tr>
              <td class="section-pad" style="padding:24px 42px 12px;background:#fffffe;background-color:#fffffe;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${rows}
                </table>
              </td>
            </tr>
            <tr>
              <td class="soft-section section-pad" bgcolor="#f7faff" style="padding:30px 42px 40px;background:#f7faff;background-color:#f7faff;border-top:1px solid #edf1f7;">
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#315f96;background-color:#315f96;color:#ffffff;text-decoration:none;border-radius:14px;padding:15px 26px;font-size:14px;font-weight:700;">
                  Abrir dashboard
                </a>
                <p class="muted-text" style="margin:18px 0 0;color:#667085;font-size:12px;line-height:1.7;font-weight:500;">
                  Envio autom&aacute;tico condicionado &agrave; ativa&ccedil;&atilde;o nas configura&ccedil;&otilde;es do dashboard.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Alerta operacional de campanhas",
    "",
    "Campanhas selecionadas por sinais objetivos de status, metrica e ritmo.",
    "",
    ...campaigns.map((item) => {
      const campaign = item.campaign;

      return [
        `- ${campaign.campaignName || "Campanha sem nome"} | PI ${campaign.piNumber || "-"} | ${CAMPAIGN_BOOST_STATUS_LABELS[item.boostStatus]}`,
        `  Metrica: contratado ${formatNumber(item.total)} | entregue ${formatNumber(item.delivered)} (${formatPct(item.deliveryPct)}) | ritmo esperado ${formatPct(item.expectedPct)} | VA ${formatPct(item.va)}`,
        `  Ultima atualizacao de metrica: ${item.lastMetricLabel}`,
        `  Evidencias: ${item.reasons.join(" ")}`,
        `  Acao sugerida: ${item.recommendation}`,
      ].join("\n");
    }),
    "",
    `Dashboard: ${appUrl}`,
  ].join("\n");

  return { html, text };
}

export async function sendSponsorshipAlertEmail({
  to,
  campaigns,
}: {
  to: string[];
  campaigns: OperationalEmailCampaign[];
}) {
  if (campaigns.length === 0) return { accepted: [], rejected: [] };

  const { host, port, user, pass, from } = getTransportConfig();
  const { html, text } = renderSponsorshipAlertEmail(campaigns);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const hasSponsorship = campaigns.some((item) => item.boostStatus === "sponsorship");
  const subject = hasSponsorship
    ? campaigns.length === 1
      ? "Alerta de Sponsorship: campanha para verificar"
      : "Alerta de Sponsorship: campanhas para verificar"
    : campaigns.length === 1
      ? "Alerta operacional: campanha para verificar"
      : "Alerta operacional: campanhas para verificar";

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}
