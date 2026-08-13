const { Client } = require("pg");
const { parseEnvFile } = require("./load-env-file.cjs");

const envFile = process.argv.find((arg) => arg.startsWith("--env-file="))?.split("=")[1];
if (envFile) Object.assign(process.env, parseEnvFile(envFile));

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL or DIRECT_URL is missing.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    await client.query(`
      create table if not exists public.campaign_metric_history (
        id uuid primary key default gen_random_uuid(),
        campaign_id uuid not null references public.campaigns(id) on delete cascade,
        recorded_at timestamptz not null default now(),
        source text not null default 'manual_update',
        updated_by uuid references public.app_users(id) on delete set null,
        previous_delivered_impressions bigint,
        delivered_impressions bigint not null default 0,
        delivered_delta bigint not null default 0,
        previous_viewability_percentage numeric,
        viewability_percentage numeric not null default 0,
        viewability_delta numeric not null default 0,
        previous_total_impressions bigint,
        total_impressions bigint not null default 0,
        total_impressions_delta bigint not null default 0,
        previous_delivery_pct numeric,
        delivery_pct numeric not null default 0,
        delivery_pct_delta numeric not null default 0,
        previous_status text,
        status text,
        metadata jsonb not null default '{}'::jsonb,
        constraint campaign_metric_history_non_negative_check check (
          delivered_impressions >= 0
          and total_impressions >= 0
          and viewability_percentage >= 0
        )
      );

      create index if not exists campaign_metric_history_campaign_recorded_idx
        on public.campaign_metric_history (campaign_id, recorded_at desc);

      create index if not exists campaign_metric_history_recorded_idx
        on public.campaign_metric_history (recorded_at desc);

      alter table public.campaign_metric_history enable row level security;
      revoke all on table public.campaign_metric_history from anon, authenticated;

      comment on table public.campaign_metric_history is
        'Snapshots of campaign delivery metrics captured on admin updates for cautious trend analysis.';
    `);

    await client.query(`
      with totals as (
        select campaign_id, coalesce(sum(volume), 0)::bigint as total_impressions
        from public.campaign_purchases
        group by campaign_id
      )
      insert into public.campaign_metric_history (
        campaign_id,
        source,
        delivered_impressions,
        delivered_delta,
        viewability_percentage,
        viewability_delta,
        total_impressions,
        total_impressions_delta,
        delivery_pct,
        delivery_pct_delta,
        status,
        metadata
      )
      select
        c.id,
        'baseline_seed',
        coalesce(c.delivered_impressions, 0),
        0,
        coalesce(c.viewability_percentage, 0),
        0,
        coalesce(t.total_impressions, 0),
        0,
        case
          when coalesce(t.total_impressions, 0) > 0
            then round((coalesce(c.delivered_impressions, 0)::numeric / t.total_impressions::numeric) * 100, 2)
          else 0
        end,
        0,
        c.status,
        jsonb_build_object('seeded', true)
      from public.campaigns c
      left join totals t on t.campaign_id = c.id
      where not exists (
        select 1
        from public.campaign_metric_history h
        where h.campaign_id = c.id
      );
    `);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const verification = await client.query(`
    select
      to_regclass('public.campaign_metric_history') is not null as table_exists,
      (select relrowsecurity from pg_class where oid = 'public.campaign_metric_history'::regclass) as rls_enabled,
      (select count(*)::int from public.campaign_metric_history) as history_rows
  `);

  console.log(JSON.stringify(verification.rows[0]));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
