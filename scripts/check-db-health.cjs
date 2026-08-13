const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  console.error(JSON.stringify({ ok: false, error: "DATABASE_URL or DIRECT_URL is missing" }));
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 1000,
  allowExitOnIdle: true,
});

async function main() {
  const columns = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
        and column_name = any($3::text[])
      order by column_name
    `,
    ["public", "app_users", ["must_change_password", "has_seen_welcome"]]
  );
  const counts = await pool.query(`
    select
      (select count(1)::int from public.app_users) as users,
      (select count(1)::int from public.campaigns) as campaigns
  `);

  console.log(
    JSON.stringify({
      ok: true,
      columns: columns.rows.map((row) => row.column_name),
      ...counts.rows[0],
    })
  );
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, code: error.code, message: error.message }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
