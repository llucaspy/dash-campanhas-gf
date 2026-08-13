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
      create table if not exists public.dashboard_daily_activity (
        user_id uuid not null references public.app_users(id) on delete cascade,
        activity_date date not null,
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(),
        primary key (user_id, activity_date),
        constraint dashboard_daily_activity_seen_order_check check (last_seen_at >= first_seen_at)
      );

      create index if not exists dashboard_daily_activity_date_user_idx
        on public.dashboard_daily_activity (activity_date desc, user_id);

      alter table public.dashboard_daily_activity enable row level security;
      revoke all on table public.dashboard_daily_activity from anon, authenticated;

      comment on table public.dashboard_daily_activity is
        'Daily authenticated dashboard activity, aggregated per user in America/Sao_Paulo.';
    `);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const verification = await client.query(`
    select
      to_regclass('public.dashboard_daily_activity') is not null as table_exists,
      (select relrowsecurity from pg_class where oid = 'public.dashboard_daily_activity'::regclass) as rls_enabled,
      (select count(*)::int from public.dashboard_daily_activity) as activity_rows
  `);

  console.log(JSON.stringify(verification.rows[0]));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
