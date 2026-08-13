import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { getUserInformationLevel } from "../../../lib/appSettings";
import { getCampaignMetricHistories } from "../../../lib/campaignMetricHistory";
import { ensureCampaignOperationalColumns } from "../../../lib/campaignOperationalSchema";
import { getEffectiveCampaignBoostStatus } from "../../../lib/campaignOperationalStatus";
import { SESSION_COOKIE, verifySessionToken } from "../../../lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const userInformationLevel = await getUserInformationLevel();
  const canViewOperationalInfo = user.role === "ADMIN" || userInformationLevel === "adops";
  await ensureCampaignOperationalColumns();

  const campaignsResult = await db.query(
    `
      select *
      from public.campaigns
      order by display_order asc nulls last, created_at desc
    `
  );
  const purchasesResult = await db.query("select * from public.campaign_purchases");
  const purchases = purchasesResult.rows;
  const metricHistories = await getCampaignMetricHistories(campaignsResult.rows.map((campaign) => campaign.id));

  const campaigns = campaignsResult.rows.map((campaign) => {
    const campaignPurchases = purchases.filter((purchase) => purchase.campaign_id === campaign.id);

    return {
      id: campaign.id,
      piNumber: campaign.pi_number,
      client: campaign.client,
      campaignName: campaign.name,
      agency: campaign.agency,
      dashLink: campaign.dashboard_url,
      gamLink: canViewOperationalInfo ? campaign.gam_link : undefined,
      hasGamLink: Boolean(campaign.gam_link),
      gmailLink: campaign.gmail_link,
      adserver: campaign.adserver,
      pdfUrl: campaign.pdf_url,
      status: campaign.status,
      boostStatus: getEffectiveCampaignBoostStatus(campaign.status, campaign.boost_status),
      boostStatusUpdatedAt: campaign.boost_status_updated_at,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
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

  return NextResponse.json({ campaigns, userInformationLevel });
}
