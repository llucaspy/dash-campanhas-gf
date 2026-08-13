const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    alter table public.campaigns
      add column if not exists display_order integer;

    with ranked as (
      select id, row_number() over (order by created_at desc) as rn
      from public.campaigns
      where display_order is null
    )
    update public.campaigns c
    set display_order = ranked.rn
    from ranked
    where c.id = ranked.id;

    create index if not exists campaigns_display_order_idx on public.campaigns(display_order, created_at desc);
  `);

  const result = await client.query("select count(*)::int as campaigns from public.campaigns where display_order is not null");
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
