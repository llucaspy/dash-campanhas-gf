import { NextResponse } from "next/server";

import { getGmailIntelligenceSettings } from "../../../../../lib/appSettings";
import { requireRequestUser } from "../../../../../lib/apiAuth";
import { db } from "../../../../../lib/db";
import { isLucasAccount } from "../../../../../lib/lucasAccess";
import { isAdmin } from "../../../../../lib/session";

function canViewGmailAlerts(user: Awaited<ReturnType<typeof requireRequestUser>>, visibility: "lucas_only" | "admin") {
  if (visibility === "admin") return isAdmin(user);
  return isLucasAccount(user);
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function lower(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function safeHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "#2563EB";
}

function isImportantSender(senderEmail: string | null | undefined, importantSenders: string[]) {
  const sender = lower(senderEmail);
  if (!sender) return false;
  return importantSenders.some((item) => lower(item) === sender);
}

export async function GET() {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const settings = await getGmailIntelligenceSettings();
  const configured =
    settings.credentialsConfigured.clientId &&
    settings.credentialsConfigured.clientSecret &&
    settings.credentialsConfigured.refreshTokenLucas;

  if (!canViewGmailAlerts(user, settings.alertVisibility)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  try {
    const result = await db.query(
      `
        with latest_threads as (
          select distinct on (coalesce(gmail_thread_id, id::text))
            id,
            sender_name,
            sender_email,
            subject,
            snippet,
            priority,
            status,
            received_at,
            gmail_url,
            matched_targets,
            reasons,
            created_at,
            coalesce(gmail_thread_id, id::text) as thread_key
          from public.gmail_alerts
          where status in ('new', 'seen', 'in_progress')
          order by coalesce(gmail_thread_id, id::text), coalesce(received_at, created_at) desc
        )
        select
          id,
          sender_name,
          sender_email,
          subject,
          snippet,
          priority,
          status,
          received_at,
          gmail_url,
          matched_targets,
          reasons,
          created_at
        from latest_threads
        order by
          case priority
            when 'critical' then 4
            when 'high' then 3
            when 'normal' then 2
            else 1
          end desc,
          coalesce(received_at, created_at) desc
        limit 12
      `
    );

    const unreadResult = await db.query(
      `
        select count(distinct coalesce(gmail_thread_id, id::text))::int as unread_count
        from public.gmail_alerts
        where status = 'new'
      `
    );

    const alerts = result.rows.map((row) => ({
      senderIsImportant: isImportantSender(row.sender_email, settings.importantSenders),
      senderColor: safeHexColor(settings.importantSenderColor),
      id: row.id,
      senderName: row.sender_name,
      senderEmail: row.sender_email,
      subject: row.subject,
      snippet: row.snippet,
      priority: row.priority || "normal",
      status: row.status || "new",
      receivedAt: row.received_at,
      gmailUrl: row.gmail_url,
      matchedTargets: toArray(row.matched_targets),
      reasons: toArray(row.reasons),
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      enabled: settings.enabled,
      configured,
      unreadCount: unreadResult.rows[0]?.unread_count || 0,
      alerts,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") {
      return NextResponse.json({
        enabled: settings.enabled,
        configured,
        unreadCount: 0,
        alerts: [],
      });
    }

    console.error("gmail_alerts_load_failed", error);
    return NextResponse.json({ error: "Nao foi possivel carregar alertas do Gmail." }, { status: 500 });
  }
}
