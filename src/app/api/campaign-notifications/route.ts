import { NextResponse } from "next/server";
import type { Campaign } from "../../../context/CampaignContext";
import { getRequestUser } from "../../../lib/apiAuth";
import { db } from "../../../lib/db";

function normalizeDateValue(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeUuidList(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => String(item || "").trim())
        .filter((item) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item))
    )
  );
}

function mapCampaign(campaign: any, purchases: any[]): Campaign & { implementationDate: string } {
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
    createdAt: normalizeDateValue(campaign.created_at),
    implementationDate: normalizeDateValue(campaign.created_at),
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
}

export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
  }

  const campaignsResult = await db.query(
    `
      with notification_window as (
        select coalesce(
          (
            select (value #>> '{}')::timestamptz
            from public.app_settings
            where key = 'campaign_notification_started_at'
            limit 1
          ),
          now()
        ) as setup_at,
        (
          date_trunc('day', timezone('America/Sao_Paulo', now())) - interval '1 day'
        ) at time zone 'America/Sao_Paulo' as starts_at,
        (
          date_trunc('day', timezone('America/Sao_Paulo', now())) + interval '1 day'
        ) at time zone 'America/Sao_Paulo' as ends_at
      )
      select c.*
      from public.campaigns c
      cross join notification_window w
      left join public.campaign_notification_views v
        on v.campaign_id = c.id
       and v.user_id = $1
      where c.created_at >= w.starts_at
        and c.created_at < w.ends_at
        and (
          v.campaign_id is null
          or v.viewed_at <= w.setup_at + interval '10 minutes'
        )
      order by c.created_at desc
      limit 20
    `,
    [user.id]
  );

  if (campaignsResult.rowCount === 0) {
    return NextResponse.json({ campaigns: [] });
  }

  const ids = campaignsResult.rows.map((campaign) => campaign.id);
  const purchasesResult = await db.query("select * from public.campaign_purchases where campaign_id = any($1::uuid[])", [ids]);

  return NextResponse.json({
    campaigns: campaignsResult.rows.map((campaign) => mapCampaign(campaign, purchasesResult.rows)),
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const campaignIds = normalizeUuidList(body.campaignIds);

  if (campaignIds.length === 0) {
    return NextResponse.json({ ok: true, viewed: 0 });
  }

  await db.query(
    `
      insert into public.campaign_notification_views (user_id, campaign_id, viewed_at)
      select $1::uuid, unnest($2::uuid[]), now()
      on conflict (user_id, campaign_id)
      do update set viewed_at = excluded.viewed_at
    `,
    [user.id, campaignIds]
  );

  return NextResponse.json({ ok: true, viewed: campaignIds.length });
}
