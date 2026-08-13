const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const result = await client.query(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('campaigns', 'campaign_purchases')
    order by table_name, ordinal_position
  `);
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
