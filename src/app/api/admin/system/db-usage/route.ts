import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { requireRequestUser } from "../../../../../lib/apiAuth";
import { isAdmin } from "../../../../../lib/session";

async function requireAdminUser() {
  const user = await requireRequestUser();
  if (!isAdmin(user)) throw new Error("FORBIDDEN");
  return user;
}

function parseLimit() {
  const raw = process.env.DATABASE_SIZE_LIMIT_BYTES;
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET() {
  const user = await requireAdminUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });

  const [databaseSize, tables, counts, attachments] = await Promise.all([
    db.query("select pg_database_size(current_database())::bigint as database_bytes"),
    db.query(`
      select
        n.nspname || '.' || c.relname as table_name,
        pg_total_relation_size(c.oid)::bigint as total_bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'm')
      order by pg_total_relation_size(c.oid) desc
      limit 8
    `),
    db.query(`
      select
        (select count(*)::int from public.campaigns) as campaigns,
        (select count(*)::int from public.app_users) as users,
        (select count(*)::int from public.global_announcements) as announcements,
        (select count(*)::int from public.user_observations) as observations
    `),
    db.query("select coalesce(sum(file_size), 0)::bigint as attachment_bytes from public.observation_attachments"),
  ]);

  const databaseBytes = Number(databaseSize.rows[0]?.database_bytes || 0);
  const limitBytes = parseLimit();
  const usagePercent = limitBytes ? Math.min(100, Math.round((databaseBytes / limitBytes) * 1000) / 10) : null;
  const status = usagePercent === null ? "monitoring" : usagePercent >= 90 ? "critical" : usagePercent >= 75 ? "warning" : "healthy";

  return NextResponse.json({
    databaseBytes,
    limitBytes,
    usagePercent,
    status,
    attachmentBytes: Number(attachments.rows[0]?.attachment_bytes || 0),
    counts: counts.rows[0] || { campaigns: 0, users: 0, announcements: 0, observations: 0 },
    tables: tables.rows.map((row) => ({
      tableName: row.table_name,
      totalBytes: Number(row.total_bytes || 0),
    })),
  });
}
