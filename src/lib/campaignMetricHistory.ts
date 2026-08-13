import type { PoolClient } from "pg";
import { db } from "./db";
import type { CampaignMetricSnapshot } from "../context/CampaignContext";

export interface CampaignMetricBaseline {
  deliveredImpressions: number;
  viewabilityPercentage: number;
  totalImpressions: number;
  deliveryPct: number;
  status: string | null;
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function getDeliveryPct(deliveredImpressions: number, totalImpressions: number) {
  if (totalImpressions <= 0) return 0;
  return Number(((deliveredImpressions / totalImpressions) * 100).toFixed(2));
}

export async function getCampaignMetricBaseline(client: PoolClient, campaignId: string, lockCampaign = false) {
  const campaignResult = await client.query(
    `
      select delivered_impressions, viewability_percentage, status
      from public.campaigns
      where id = $1
      ${lockCampaign ? "for update" : ""}
    `,
    [campaignId]
  );

  if (campaignResult.rowCount === 0) return null;

  const totalResult = await client.query(
    `
      select coalesce(sum(volume), 0)::bigint as total_impressions
      from public.campaign_purchases
      where campaign_id = $1
    `,
    [campaignId]
  );

  const deliveredImpressions = toNumber(campaignResult.rows[0].delivered_impressions);
  const viewabilityPercentage = toNumber(campaignResult.rows[0].viewability_percentage);
  const totalImpressions = toNumber(totalResult.rows[0]?.total_impressions);

  return {
    deliveredImpressions,
    viewabilityPercentage,
    totalImpressions,
    deliveryPct: getDeliveryPct(deliveredImpressions, totalImpressions),
    status: campaignResult.rows[0].status || null,
  } satisfies CampaignMetricBaseline;
}

export async function insertCampaignMetricSnapshot(
  client: PoolClient,
  {
    campaignId,
    source,
    updatedBy,
    previous,
    metadata = {},
  }: {
    campaignId: string;
    source: string;
    updatedBy?: string | null;
    previous?: CampaignMetricBaseline | null;
    metadata?: Record<string, unknown>;
  }
) {
  const current = await getCampaignMetricBaseline(client, campaignId);
  if (!current) return null;

  const deliveredDelta = previous ? current.deliveredImpressions - previous.deliveredImpressions : 0;
  const viewabilityDelta = previous ? current.viewabilityPercentage - previous.viewabilityPercentage : 0;
  const totalImpressionsDelta = previous ? current.totalImpressions - previous.totalImpressions : 0;
  const deliveryPctDelta = previous ? current.deliveryPct - previous.deliveryPct : 0;

  const result = await client.query(
    `
      insert into public.campaign_metric_history (
        campaign_id,
        source,
        updated_by,
        previous_delivered_impressions,
        delivered_impressions,
        delivered_delta,
        previous_viewability_percentage,
        viewability_percentage,
        viewability_delta,
        previous_total_impressions,
        total_impressions,
        total_impressions_delta,
        previous_delivery_pct,
        delivery_pct,
        delivery_pct_delta,
        previous_status,
        status,
        metadata
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
      returning id
    `,
    [
      campaignId,
      source,
      updatedBy || null,
      previous?.deliveredImpressions ?? null,
      current.deliveredImpressions,
      deliveredDelta,
      previous?.viewabilityPercentage ?? null,
      current.viewabilityPercentage,
      viewabilityDelta,
      previous?.totalImpressions ?? null,
      current.totalImpressions,
      totalImpressionsDelta,
      previous?.deliveryPct ?? null,
      current.deliveryPct,
      deliveryPctDelta,
      previous?.status ?? null,
      current.status,
      JSON.stringify(metadata),
    ]
  );

  return result.rows[0]?.id || null;
}

function mapHistoryRow(row: any): CampaignMetricSnapshot {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    recordedAt: row.recorded_at,
    source: row.source,
    previousDeliveredImpressions: row.previous_delivered_impressions === null ? null : toNumber(row.previous_delivered_impressions),
    deliveredImpressions: toNumber(row.delivered_impressions),
    deliveredDelta: toNumber(row.delivered_delta),
    previousViewabilityPercentage: row.previous_viewability_percentage === null ? null : toNumber(row.previous_viewability_percentage),
    viewabilityPercentage: toNumber(row.viewability_percentage),
    viewabilityDelta: toNumber(row.viewability_delta),
    previousTotalImpressions: row.previous_total_impressions === null ? null : toNumber(row.previous_total_impressions),
    totalImpressions: toNumber(row.total_impressions),
    totalImpressionsDelta: toNumber(row.total_impressions_delta),
    previousDeliveryPct: row.previous_delivery_pct === null ? null : toNumber(row.previous_delivery_pct),
    deliveryPct: toNumber(row.delivery_pct),
    deliveryPctDelta: toNumber(row.delivery_pct_delta),
    previousStatus: row.previous_status,
    status: row.status,
  };
}

export async function getCampaignMetricHistories(campaignIds: string[], perCampaignLimit = 8) {
  const grouped = new Map<string, CampaignMetricSnapshot[]>();
  if (campaignIds.length === 0) return grouped;

  try {
    const result = await db.query(
      `
        with ranked as (
          select
            h.*,
            row_number() over (partition by h.campaign_id order by h.recorded_at desc) as rn
          from public.campaign_metric_history h
          where h.campaign_id = any($1::uuid[])
        )
        select *
        from ranked
        where rn <= $2
        order by campaign_id, recorded_at desc
      `,
      [campaignIds, perCampaignLimit]
    );

    for (const row of result.rows) {
      const snapshot = mapHistoryRow(row);
      const current = grouped.get(snapshot.campaignId) || [];
      current.push(snapshot);
      grouped.set(snapshot.campaignId, current);
    }
  } catch (error: any) {
    if (error?.code === "42P01") return grouped;
    throw error;
  }

  return grouped;
}
