import type { Campaign } from "../context/CampaignContext";
import { db } from "./db";
import { getCampaignMetricHistories } from "./campaignMetricHistory";
import { ensureCampaignOperationalColumns } from "./campaignOperationalSchema";
import { getEffectiveCampaignBoostStatus } from "./campaignOperationalStatus";

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export async function loadCampaignsForOperationalAlerts(): Promise<Campaign[]> {
  await ensureCampaignOperationalColumns();

  const campaignsResult = await db.query(`
    select *
    from public.campaigns
    order by display_order asc nulls last, created_at desc
  `);
  const purchasesResult = await db.query("select * from public.campaign_purchases");
  const purchases = purchasesResult.rows;
  const metricHistories = await getCampaignMetricHistories(campaignsResult.rows.map((campaign) => campaign.id), 1);

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
      boostStatus: getEffectiveCampaignBoostStatus(campaign.status, campaign.boost_status),
      boostStatusUpdatedAt: campaign.boost_status_updated_at,
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
      metricHistory: metricHistories.get(campaign.id) || [],
    };
  });
}
