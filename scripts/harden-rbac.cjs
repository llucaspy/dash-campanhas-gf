const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    revoke all privileges on table public.campaigns from anon, authenticated;
    revoke all privileges on table public.campaign_purchases from anon, authenticated;

    revoke all on table public.app_users from anon, authenticated;
  `);

  const result = await client.query(`
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name in ('campaigns', 'campaign_purchases', 'app_users')
    order by table_name, grantee, privilege_type
  `);
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
