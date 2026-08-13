const { Client } = require("pg");
const { parseEnvFile } = require("./load-env-file.cjs");

const envFileArgIndex = process.argv.indexOf("--env-file");
if (envFileArgIndex !== -1 && process.argv[envFileArgIndex + 1]) {
  Object.assign(process.env, parseEnvFile(process.argv[envFileArgIndex + 1]));
}

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public.campaign_notification_views (
      user_id uuid not null references public.app_users(id) on delete cascade,
      campaign_id uuid not null references public.campaigns(id) on delete cascade,
      viewed_at timestamptz not null default now(),
      primary key (user_id, campaign_id)
    );

    create index if not exists campaign_notification_views_campaign_idx
      on public.campaign_notification_views(campaign_id);

    alter table public.campaign_notification_views enable row level security;

    revoke all privileges on table public.campaign_notification_views from anon, authenticated;

    insert into public.app_settings (key, value, updated_at)
    values ('campaign_notification_started_at', to_jsonb(now()::text), now())
    on conflict (key) do nothing;

    insert into public.campaign_notification_views (user_id, campaign_id, viewed_at)
    select u.id, c.id, now()
    from public.app_users u
    cross join public.campaigns c
    on conflict (user_id, campaign_id) do nothing;
  `);

  const result = await client.query(`
    select
      (select count(*)::int from public.campaign_notification_views) as viewed_rows,
      (select value from public.app_settings where key = 'campaign_notification_started_at') as started_at
  `);
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
