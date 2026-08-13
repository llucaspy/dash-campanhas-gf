const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public.global_announcements (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      body text not null,
      priority text not null default 'normal' check (priority in ('normal', 'important')),
      active boolean not null default true,
      created_by uuid references public.app_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.user_observations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.app_users(id) on delete cascade,
      subject text not null,
      body text not null,
      status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.observation_attachments (
      id uuid primary key default gen_random_uuid(),
      observation_id uuid not null references public.user_observations(id) on delete cascade,
      file_name text not null,
      content_type text not null default 'application/octet-stream',
      file_size integer not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );

    create index if not exists global_announcements_active_idx on public.global_announcements(active, created_at desc);
    create index if not exists user_observations_user_idx on public.user_observations(user_id, created_at desc);
    create index if not exists observation_attachments_observation_idx on public.observation_attachments(observation_id);

    revoke all privileges on table public.global_announcements from anon, authenticated;
    revoke all privileges on table public.user_observations from anon, authenticated;
    revoke all privileges on table public.observation_attachments from anon, authenticated;
  `);

  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('global_announcements', 'user_observations', 'observation_attachments')
    order by table_name
  `);
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
