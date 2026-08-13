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
      create table if not exists public.gmail_mailboxes (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        display_name text,
        enabled boolean not null default true,
        last_history_id text,
        last_sync_at timestamptz,
        last_error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists public.gmail_alerts (
        id uuid primary key default gen_random_uuid(),
        mailbox_id uuid not null references public.gmail_mailboxes(id) on delete cascade,
        gmail_message_id text not null,
        gmail_thread_id text,
        received_at timestamptz,
        sender_name text,
        sender_email text,
        subject text,
        snippet text,
        matched_targets text[] not null default '{}',
        priority text not null default 'normal',
        reasons jsonb not null default '[]'::jsonb,
        gmail_url text,
        status text not null default 'new',
        seen_by uuid references public.app_users(id) on delete set null,
        seen_at timestamptz,
        resolved_by uuid references public.app_users(id) on delete set null,
        resolved_at timestamptz,
        ignored_by uuid references public.app_users(id) on delete set null,
        ignored_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint gmail_alerts_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
        constraint gmail_alerts_status_check check (status in ('new', 'seen', 'in_progress', 'resolved', 'ignored')),
        unique(mailbox_id, gmail_message_id)
      );

      create table if not exists public.gmail_sync_logs (
        id uuid primary key default gen_random_uuid(),
        mailbox_id uuid references public.gmail_mailboxes(id) on delete set null,
        event_type text not null,
        history_id text,
        status text not null,
        payload jsonb,
        error_message text,
        created_at timestamptz not null default now()
      );

      create index if not exists gmail_alerts_status_created_idx
        on public.gmail_alerts(status, created_at desc);

      create index if not exists gmail_alerts_mailbox_created_idx
        on public.gmail_alerts(mailbox_id, created_at desc);

      create index if not exists gmail_alerts_priority_created_idx
        on public.gmail_alerts(priority, created_at desc);

      create index if not exists gmail_sync_logs_created_idx
        on public.gmail_sync_logs(created_at desc);

      alter table public.gmail_mailboxes enable row level security;
      alter table public.gmail_alerts enable row level security;
      alter table public.gmail_sync_logs enable row level security;

      revoke all on table public.gmail_mailboxes from anon, authenticated;
      revoke all on table public.gmail_alerts from anon, authenticated;
      revoke all on table public.gmail_sync_logs from anon, authenticated;

      comment on table public.gmail_alerts is
        'Operational Gmail alerts generated for Dashboard GF from the monitored Lucas mailbox.';
    `);

    await client.query(`
      insert into public.gmail_mailboxes (email, display_name)
      values ('lucas.mendonca@metropoles.com', 'Lucas Mendonca')
      on conflict (email)
      do update set display_name = excluded.display_name, updated_at = now()
    `);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const verification = await client.query(`
    select
      to_regclass('public.gmail_mailboxes') is not null as mailboxes_table,
      to_regclass('public.gmail_alerts') is not null as alerts_table,
      to_regclass('public.gmail_sync_logs') is not null as logs_table,
      (select count(*)::int from public.gmail_mailboxes) as mailboxes,
      (select count(*)::int from public.gmail_alerts) as alerts
  `);

  console.log(JSON.stringify(verification.rows[0]));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
