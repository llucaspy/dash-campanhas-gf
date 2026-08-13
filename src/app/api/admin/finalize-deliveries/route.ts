import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import type { Campaign } from "../../../../context/CampaignContext";
import { getRequestUser } from "../../../../lib/apiAuth";
import { splitCampaignsByArchive } from "../../../../lib/campaignArchive";
import { getCampaignMetricBaseline, insertCampaignMetricSnapshot } from "../../../../lib/campaignMetricHistory";
import { db } from "../../../../lib/db";
import { buildDeliveryPreview, sendDeliveryPreviewEmail } from "../../../../lib/deliveryPreviewEmail";
import { isAdmin } from "../../../../lib/session";

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

function normalizeCampaignIds(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean)));
}

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
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

async function finalizeCampaigns(client: PoolClient, campaignIds: string[], updatedBy: string) {
  const finalized: string[] = [];

  for (const campaignId of campaignIds) {
    const previous = await getCampaignMetricBaseline(client, campaignId, true);
    if (!previous || previous.status === "finalizada") continue;

    const result = await client.query(
      `
        update public.campaigns
        set status = 'finalizada',
            boost_status = 'normal',
            boost_status_updated_at = case when boost_status <> 'normal' then now() else boost_status_updated_at end,
            updated_at = now()
        where id = $1
          and status <> 'finalizada'
        returning id
      `,
      [campaignId]
    );

    if (result.rowCount === 0) continue;

    await insertCampaignMetricSnapshot(client, {
      campaignId,
      source: "delivery_finalized",
      updatedBy,
      previous,
      metadata: { reason: "manual_finalize_deliveries" },
    });
    finalized.push(campaignId);
  }

  return finalized;
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const sendPreview = Boolean(body.sendPreview);
  const recipients = normalizeEmailList(body.recipients);
  const requestedCampaignIds = normalizeCampaignIds(body.campaignIds);

  if (sendPreview && recipients.length === 0) {
    return NextResponse.json({ error: "Informe pelo menos um destinatario valido para enviar o preview." }, { status: 400 });
  }

  try {
    const campaigns = await loadCampaigns();
    const { currentCampaigns } = splitCampaignsByArchive(campaigns);
    const currentIds = new Set(currentCampaigns.map((campaign) => campaign.id));
    const campaignIds = requestedCampaignIds.length > 0 ? requestedCampaignIds.filter((id) => currentIds.has(id)) : Array.from(currentIds);
    const selectedCampaigns = campaigns.filter((campaign) => campaignIds.includes(campaign.id) && campaign.status !== "finalizada");

    if (selectedCampaigns.length === 0) {
      return NextResponse.json({ error: "Nenhuma campanha disponivel para finalizar." }, { status: 400 });
    }

    const draftPreview = buildDeliveryPreview(selectedCampaigns);
    if (sendPreview && draftPreview.metrics.activeCount === 0) {
      return NextResponse.json({ error: "As campanhas selecionadas nao estao elegiveis para o preview." }, { status: 400 });
    }

    const emailInfo = sendPreview ? await sendDeliveryPreviewEmail({ to: recipients, campaigns: selectedCampaigns }) : null;
    const client = await db.connect();

    try {
      await client.query("begin");
      const finalizedIds = await finalizeCampaigns(client, campaignIds, user.id);
      await client.query("commit");

      return NextResponse.json({
        ok: true,
        finalized: finalizedIds.length,
        finalizedCampaigns: selectedCampaigns
          .filter((campaign) => finalizedIds.includes(campaign.id))
          .map((campaign) => ({ id: campaign.id, piNumber: campaign.piNumber, campaignName: campaign.campaignName })),
        email: emailInfo
          ? {
              sent: Array.isArray(emailInfo.info.accepted) ? emailInfo.info.accepted.length : recipients.length,
              rejected: emailInfo.info.rejected || [],
              recipients,
              metrics: emailInfo.preview.metrics,
            }
          : { sent: 0, skipped: true },
      });
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao finalizar entregas.";
    console.error("finalize-deliveries", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
