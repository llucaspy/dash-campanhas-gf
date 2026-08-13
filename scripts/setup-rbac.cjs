const { Client } = require("pg");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

if (!adminPasswordHash) {
  console.error("ADMIN_PASSWORD_HASH is required.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    create extension if not exists pgcrypto;

    create table if not exists public.app_users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      username text not null unique,
      email text not null unique,
      password_hash text not null,
      role text not null check (role in ('ADMIN', 'USER')),
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists app_users_role_idx on public.app_users(role);
    create index if not exists app_users_active_idx on public.app_users(active);
  `);

  await client.query(
    `
      insert into public.app_users (name, username, email, password_hash, role, active)
      values ($1, $2, $3, $4, 'ADMIN', true)
      on conflict (username) do update set
        name = excluded.name,
        email = excluded.email,
        password_hash = excluded.password_hash,
        role = 'ADMIN',
        active = true,
        updated_at = now()
    `,
    ["Lucas Paim", "lucas", "lucas@adsnap.internal", adminPasswordHash]
  );

  const result = await client.query(
    "select id, name, username, email, role, active from public.app_users order by created_at"
  );
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
