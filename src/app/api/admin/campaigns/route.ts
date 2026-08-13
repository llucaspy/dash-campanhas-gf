import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { db } from "../../../../lib/db";
import { insertCampaignMetricSnapshot } from "../../../../lib/campaignMetricHistory";
import { ensureCampaignOperationalColumns } from "../../../../lib/campaignOperationalSchema";
import { normalizeCampaignBoostStatus } from "../../../../lib/campaignOperationalStatus";
import { isAdmin, SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";

async function requireAdmin() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return isAdmin(user) ? user : null;
}

function toNumber(value: string | number | undefined) {
  if (typeof value === "number") return value;
  return parseInt(String(value || "0").replace(/\./g, ""), 10) || 0;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const body = await request.json();
  const boostStatus = body.status === "pausada" ? "normal" : normalizeCampaignBoostStatus(body.boostStatus);
  let client: PoolClient | null = null;

  try {
    await ensureCampaignOperationalColumns();
    client = await db.connect();
    await client.query("begin");
    const result = await client.query(
      `
        insert into public.campaigns (
          pi_number, client, name, agency, dashboard_url, gam_link, gmail_link,
          adserver, pdf_url, status, boost_status, boost_status_updated_at,
          start_date, end_date, viewability_percentage
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,0)
        returning id
      `,
      [
        body.piNumber,
        body.client,
        body.campaignName,
        body.agency,
        body.dashLink || null,
        body.gamLink || null,
        body.gmailLink || null,
        body.adserver || null,
        body.pdfUrl || null,
        body.status,
        boostStatus,
        body.startDate,
        body.endDate,
      ]
    );

    const campaignId = result.rows[0].id;
    const purchases = [
      ...(body.paidPurchases || []).map((purchase: any) => ({ ...purchase, type: "paid" })),
      ...(body.bonusPurchases || []).map((purchase: any) => ({ ...purchase, type: "bonus" })),
    ];

    for (const purchase of purchases) {
      await client.query(
        `
          insert into public.campaign_purchases (campaign_id, type, description, volume)
          values ($1, $2, $3, $4)
        `,
        [campaignId, purchase.type, purchase.description, toNumber(purchase.volume)]
      );
    }

    await insertCampaignMetricSnapshot(client, {
      campaignId,
      source: "campaign_created",
      updatedBy: admin.id,
      metadata: { reason: "admin_create" },
    });

    await client.query("commit");
    return NextResponse.json({ id: campaignId }, { status: 201 });
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    console.error(error);
    return NextResponse.json({ error: "Falha ao salvar campanha." }, { status: 500 });
  } finally {
    client?.release();
  }
}
