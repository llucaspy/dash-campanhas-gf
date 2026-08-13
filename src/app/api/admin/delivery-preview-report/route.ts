import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getRequestUser } from "../../../../lib/apiAuth";
import { buildDeliveryPreview, sendDeliveryPreviewEmail } from "../../../../lib/deliveryPreviewEmail";
import { isAdmin } from "../../../../lib/session";
import type { Campaign } from "../../../../context/CampaignContext";

function normalizeEmailList(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];
  return Array.from(
    new Set(
      source
        .map((item) => String(item).trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
  );
}

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function normalizeCampaignIds(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean)));
}

async function loadCampaigns(): Promise<Campaign[]> {
  const campaignsResult = await db.query(`
    select *
    from public.campaigns
    order by display_order asc nulls last, created_at desc
  `);
  const purchasesResult = await db.query("select * from public.campaign_purchases");
  const purchases = purchasesResult.rows;

  return campaignsResult.rows.map((campaign) => {
    const campaignPurchases = purchases.filter((purchase) => purchase.campaign_id === campaign.id);

    return {
      id: campaign.id,
      piNumber: campaign.pi_number,
      client: campaign.client,
      campaignName: campaign.name,
      agency: campaign.agency,
      dashLink: campaign.dashboard_url,
      gamLink: campaign.gam_link,
      hasGamLink: Boolean(campaign.gam_link),
      gmailLink: campaign.gmail_link,
      adserver: campaign.adserver,
      pdfUrl: campaign.pdf_url,
      status: campaign.status,
      startDate: normalizeDateValue(campaign.start_date),
      endDate: normalizeDateValue(campaign.end_date),
      deliveredImpressions: Number(campaign.delivered_impressions || 0),
      viewabilityPercentage: Number(campaign.viewability_percentage || 0),
      createdAt: campaign.created_at,
      displayOrder: campaign.display_order,
      paidPurchases: campaignPurchases
        .filter((purchase) => purchase.type === "paid")
        .map((purchase) => ({
          id: purchase.id,
          description: purchase.description,
          volume: Number(purchase.volume || 0).toLocaleString("pt-BR"),
          type: "paid",
        })),
      bonusPurchases: campaignPurchases
        .filter((purchase) => purchase.type === "bonus")
        .map((purchase) => ({
          id: purchase.id,
          description: purchase.description,
          volume: Number(purchase.volume || 0).toLocaleString("pt-BR"),
          type: "bonus",
        })),
    };
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const recipients = normalizeEmailList(body.recipients);
  const campaignIds = normalizeCampaignIds(body.campaignIds);
  const testMode = Boolean(body.testMode);

  if (recipients.length === 0) {
    return NextResponse.json({ error: "Informe pelo menos um destinatario valido." }, { status: 400 });
  }

  try {
    const campaigns = await loadCampaigns();
    const selectedCampaigns =
      campaignIds.length > 0 ? campaigns.filter((campaign) => campaignIds.includes(campaign.id)) : campaigns;

    if (selectedCampaigns.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos uma campanha valida para o relatorio." }, { status: 400 });
    }

    const draftPreview = buildDeliveryPreview(selectedCampaigns);
    if (draftPreview.metrics.activeCount === 0) {
      return NextResponse.json({ error: "As campanhas selecionadas nao estao elegiveis para o relatorio." }, { status: 400 });
    }

    const { info, preview } = await sendDeliveryPreviewEmail({
      to: recipients,
      campaigns: selectedCampaigns,
      subjectPrefix: testMode ? "[Teste] " : "",
    });

    return NextResponse.json({
      ok: true,
      testMode,
      accepted: info.accepted,
      rejected: info.rejected,
      metrics: preview.metrics,
      best: preview.best.map((item) => item.campaign.campaignName),
      watch: preview.watch.map((item) => item.campaign.campaignName),
      watchTitle: preview.watchTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar relatorio.";
    console.error("delivery-preview-report", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
