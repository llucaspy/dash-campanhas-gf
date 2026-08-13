const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    alter table public.global_announcements
      add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
      add column if not exists boost_status text not null default 'normal';

    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'global_announcements_boost_status_check'
      ) then
        alter table public.global_announcements
          add constraint global_announcements_boost_status_check
          check (boost_status in ('sponsorship', 'high', 'normal', 'low'));
      end if;
    end $$;

    create index if not exists global_announcements_campaign_idx on public.global_announcements(campaign_id);
    create index if not exists global_announcements_boost_idx on public.global_announcements(boost_status, active, created_at desc);
  `);

  const result = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'global_announcements'
      and column_name in ('campaign_id', 'boost_status')
    order by column_name
  `);
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
