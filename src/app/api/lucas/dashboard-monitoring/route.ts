import { NextResponse } from "next/server";

import { getRequestUser } from "../../../../lib/apiAuth";
import { db } from "../../../../lib/db";
import { isLucasAccount } from "../../../../lib/lucasAccess";

interface MonitoringRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "USER";
  created_at: string;
  last_activity_date: string | null;
  last_seen_at: string | null;
  last_seen_today: string | null;
  active_days_7: number;
  active_days_30: number;
  activity_history: Array<{
    date: string;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
}

export async function GET() {
  const user = await getRequestUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  if (!isLucasAccount(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  try {
    const result = await db.query<MonitoringRow>(
      `
        with bounds as (
          select (timezone('America/Sao_Paulo', now()))::date as today
        )
        select
          u.id,
          u.name,
          u.username,
          u.email,
          u.role,
          u.created_at,
          to_char(max(a.activity_date), 'YYYY-MM-DD') as last_activity_date,
          max(a.last_seen_at) as last_seen_at,
          max(a.last_seen_at) filter (where a.activity_date = b.today) as last_seen_today,
          count(a.activity_date) filter (where a.activity_date >= b.today - 6)::int as active_days_7,
          count(a.activity_date) filter (where a.activity_date >= b.today - 29)::int as active_days_30,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'date', to_char(a.activity_date, 'YYYY-MM-DD'),
                'firstSeenAt', a.first_seen_at,
                'lastSeenAt', a.last_seen_at
              )
              order by a.activity_date
            ) filter (where a.activity_date >= b.today - 29),
            '[]'::jsonb
          ) as activity_history
        from public.app_users u
        cross join bounds b
        left join public.dashboard_daily_activity a on a.user_id = u.id
        where u.active = true
          and u.id <> $1
        group by u.id, u.name, u.username, u.email, u.role, u.created_at, b.today
        order by
          (max(a.last_seen_at) filter (where a.activity_date = b.today) is not null) asc,
          max(a.activity_date) asc nulls first,
          lower(u.name)
      `,
      [user.id]
    );

    const users = result.rows;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const monitoredUsers = users.length;
    const activeToday = users.filter((item) => Boolean(item.last_seen_today)).length;
    const staleUsers = users.filter((item) => {
      if (!item.last_activity_date) return true;
      const last = new Date(`${item.last_activity_date}T12:00:00Z`);
      const current = new Date(`${today}T12:00:00Z`);
      return Math.round((current.getTime() - last.getTime()) / 86_400_000) >= 3;
    }).length;
    const possibleDays = monitoredUsers * 7;
    const adherence7 = possibleDays
      ? Math.round((users.reduce((sum, item) => sum + item.active_days_7, 0) / possibleDays) * 100)
      : 0;

    return NextResponse.json({
      today,
      generatedAt: new Date().toISOString(),
      summary: {
        monitoredUsers,
        activeToday,
        pendingToday: monitoredUsers - activeToday,
        staleUsers,
        adherence7,
      },
      users,
    });
  } catch (error) {
    console.error("dashboard-monitoring", error);
    return NextResponse.json({ error: "Não foi possível carregar o acompanhamento." }, { status: 500 });
  }
}
