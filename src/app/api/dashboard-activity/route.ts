import { NextResponse } from "next/server";

import { getRequestUser } from "../../../lib/apiAuth";
import { db } from "../../../lib/db";

export async function POST() {
  const user = await getRequestUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  try {
    const result = await db.query<{ activity_date: string; last_seen_at: string }>(
      `
        insert into public.dashboard_daily_activity (user_id, activity_date, first_seen_at, last_seen_at)
        select
          u.id,
          (timezone('America/Sao_Paulo', now()))::date,
          now(),
          now()
        from public.app_users u
        where u.id = $1
          and u.active = true
        on conflict (user_id, activity_date)
        do update set last_seen_at = greatest(public.dashboard_daily_activity.last_seen_at, excluded.last_seen_at)
        returning to_char(activity_date, 'YYYY-MM-DD') as activity_date, last_seen_at
      `,
      [user.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Usuário inativo." }, { status: 403 });
    }

    return NextResponse.json({ ok: true, activity: result.rows[0] });
  } catch (error) {
    console.error("dashboard-activity", error);
    return NextResponse.json({ error: "Não foi possível registrar a atividade." }, { status: 500 });
  }
}
