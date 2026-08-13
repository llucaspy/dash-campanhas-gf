import { NextResponse } from "next/server";

import { getGmailIntelligenceSettings } from "../../../../../../../lib/appSettings";
import { requireRequestUser } from "../../../../../../../lib/apiAuth";
import { db } from "../../../../../../../lib/db";
import { isLucasAccount } from "../../../../../../../lib/lucasAccess";
import { isAdmin } from "../../../../../../../lib/session";

function canManageGmailAlert(user: Awaited<ReturnType<typeof requireRequestUser>>, visibility: "lucas_only" | "admin") {
  if (visibility === "admin") return isAdmin(user);
  return isLucasAccount(user);
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const settings = await getGmailIntelligenceSettings();
  if (!canManageGmailAlert(user, settings.alertVisibility)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Email nao informado." }, { status: 400 });

  const current = await db.query<{ id: string; gmail_thread_id: string | null }>(
    `
      select id, gmail_thread_id
      from public.gmail_alerts
      where id = $1
      limit 1
    `,
    [id]
  );

  const alert = current.rows[0];
  if (!alert) return NextResponse.json({ error: "Email nao encontrado." }, { status: 404 });

  const result = await db.query(
    `
      update public.gmail_alerts
      set
        status = 'ignored',
        ignored_by = $2,
        ignored_at = now(),
        updated_at = now()
      where
        status in ('new', 'seen', 'in_progress')
        and (
          ($3::text is not null and gmail_thread_id = $3)
          or id = $1
        )
    `,
    [alert.id, user.id, alert.gmail_thread_id]
  );

  return NextResponse.json({
    ok: true,
    dismissed: result.rowCount || 0,
    message: "Email removido do card.",
  });
}
