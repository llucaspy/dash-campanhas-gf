const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public.app_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    );

    insert into public.app_settings (key, value)
    values ('communications_enabled', 'true'::jsonb)
    on conflict (key) do nothing;

    insert into public.app_settings (key, value)
    values ('user_information_level', '"light"'::jsonb)
    on conflict (key) do nothing;

    revoke all privileges on table public.app_settings from anon, authenticated;
  `);

  const result = await client.query("select key, value from public.app_settings order by key");
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
