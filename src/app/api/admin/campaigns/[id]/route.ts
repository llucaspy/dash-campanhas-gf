import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { getCampaignMetricBaseline, insertCampaignMetricSnapshot } from "../../../../../lib/campaignMetricHistory";
import { ensureCampaignOperationalColumns } from "../../../../../lib/campaignOperationalSchema";
import { normalizeCampaignBoostStatus } from "../../../../../lib/campaignOperationalStatus";
import { isAdmin, SESSION_COOKIE, verifySessionToken } from "../../../../../lib/session";

async function requireAdmin() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return isAdmin(user) ? user : null;
}

function toNumber(value: string | number | undefined) {
  if (typeof value === "number") return value;
  return parseInt(String(value || "0").replace(/\./g, ""), 10) || 0;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  await ensureCampaignOperationalColumns();
  const client = await db.connect();

  try {
    await client.query("begin");

    const dbUpdates: Record<string, unknown> = {};
    if (body.piNumber !== undefined) dbUpdates.pi_number = body.piNumber;
    if (body.client !== undefined) dbUpdates.client = body.client;
    if (body.campaignName !== undefined) dbUpdates.name = body.campaignName;
    if (body.agency !== undefined) dbUpdates.agency = body.agency;
    if (body.dashLink !== undefined) dbUpdates.dashboard_url = body.dashLink;
    if (body.gamLink !== undefined) dbUpdates.gam_link = body.gamLink;
    if (body.gmailLink !== undefined) dbUpdates.gmail_link = body.gmailLink;
    if (body.adserver !== undefined) dbUpdates.adserver = body.adserver;
    if (body.pdfUrl !== undefined) dbUpdates.pdf_url = body.pdfUrl;
    const shouldClearBoostStatus = body.status === "pausada";
    if (body.status !== undefined) dbUpdates.status = body.status;
    if (body.boostStatus !== undefined || shouldClearBoostStatus) {
      dbUpdates.boost_status = shouldClearBoostStatus ? "normal" : normalizeCampaignBoostStatus(body.boostStatus);
      dbUpdates.boost_status_updated_at = new Date().toISOString();
    }
    if (body.startDate !== undefined) dbUpdates.start_date = body.startDate;
    if (body.endDate !== undefined) dbUpdates.end_date = body.endDate;
    if (body.deliveredImpressions !== undefined) dbUpdates.delivered_impressions = body.deliveredImpressions;
    if (body.viewabilityPercentage !== undefined) dbUpdates.viewability_percentage = body.viewabilityPercentage;
    if (body.displayOrder !== undefined) dbUpdates.display_order = body.displayOrder;

    const shouldRecordMetricSnapshot =
      body.deliveredImpressions !== undefined ||
      body.viewabilityPercentage !== undefined ||
      body.status !== undefined ||
      body.boostStatus !== undefined ||
      body.startDate !== undefined ||
      body.endDate !== undefined ||
      Boolean(body.paidPurchases || body.bonusPurchases);

    const previousMetrics = shouldRecordMetricSnapshot ? await getCampaignMetricBaseline(client, id, true) : null;

    if (shouldRecordMetricSnapshot && !previousMetrics) {
      await client.query("rollback");
      return NextResponse.json({ error: "Campanha nao encontrada." }, { status: 404 });
    }

    const entries = Object.entries(dbUpdates);
    if (entries.length > 0) {
      const sets = entries.map(([key], index) => `${key} = $${index + 1}`).join(", ");
      await client.query(
        `update public.campaigns set ${sets}, updated_at = now() where id = $${entries.length + 1}`,
        [...entries.map(([, value]) => value), id]
      );
    }

    if (body.paidPurchases || body.bonusPurchases) {
      await client.query("delete from public.campaign_purchases where campaign_id = $1", [id]);
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
          [id, purchase.type, purchase.description, toNumber(purchase.volume)]
        );
      }
    }

    if (shouldRecordMetricSnapshot) {
      await insertCampaignMetricSnapshot(client, {
        campaignId: id,
        source: "manual_update",
        updatedBy: admin.id,
        previous: previousMetrics,
        metadata: {
          updatedFields: Object.keys(dbUpdates).filter((field) => field !== "display_order"),
          purchasesChanged: Boolean(body.paidPurchases || body.bonusPurchases),
        },
      });
    }

    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "Falha ao atualizar campanha." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  const client = await db.connect();

  try {
    await client.query("begin");
    await client.query("delete from public.campaign_purchases where campaign_id = $1", [id]);
    await client.query("delete from public.campaigns where id = $1", [id]);
    await client.query("commit");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "Falha ao remover campanha." }, { status: 500 });
  } finally {
    client.release();
  }
}
