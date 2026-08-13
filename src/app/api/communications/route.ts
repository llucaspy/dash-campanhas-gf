import { NextResponse } from "next/server";
import { getCommunicationsEnabled, getUserInformationLevel } from "../../../lib/appSettings";
import { db } from "../../../lib/db";
import { requireRequestUser } from "../../../lib/apiAuth";
import { isAdmin } from "../../../lib/session";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function GET() {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const communicationsEnabled = await getCommunicationsEnabled();
  const userInformationLevel = await getUserInformationLevel();
  const canViewOperationalInfo = isAdmin(user) || userInformationLevel === "adops";
  if (!communicationsEnabled) {
    return NextResponse.json({ announcements: [], observations: [], communicationsEnabled, userInformationLevel });
  }

  const announcements = await db.query(
    `
      select a.id, a.title, a.body, a.priority, a.active, a.created_at, a.campaign_id, a.boost_status,
        u.name as author_name,
        c.pi_number as campaign_pi,
        c.name as campaign_name,
        c.dashboard_url as campaign_dashboard_url,
        ${canViewOperationalInfo ? "c.gam_link" : "null"} as campaign_gam_link
      from public.global_announcements a
      left join public.app_users u on u.id = a.created_by
      left join public.campaigns c on c.id = a.campaign_id
      where a.active = true
      order by case when a.boost_status = 'sponsorship' then 0 else 1 end, a.created_at desc
      limit 8
    `
  );

  const observations = await db.query(
    `
      select o.id, o.subject, o.body, o.status, o.created_at,
        coalesce(json_agg(json_build_object(
          'id', att.id,
          'fileName', att.file_name,
          'fileSize', att.file_size,
          'contentType', att.content_type
        )) filter (where att.id is not null), '[]') as attachments
      from public.user_observations o
      left join public.observation_attachments att on att.observation_id = o.id
      where o.user_id = $1
      group by o.id
      order by o.created_at desc
      limit 6
    `,
    [user.id]
  );

  return NextResponse.json({ announcements: announcements.rows, observations: observations.rows, communicationsEnabled, userInformationLevel });
}

export async function POST(request: Request) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const communicationsEnabled = await getCommunicationsEnabled();
  if (!communicationsEnabled) {
    return NextResponse.json({ error: "Comunicacoes desativadas por Lucas." }, { status: 403 });
  }

  const formData = await request.formData();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const files = formData.getAll("attachments").filter((file): file is File => file instanceof File && file.size > 0);

  if (!subject || !body) {
    return NextResponse.json({ error: "Informe assunto e observacao." }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Arquivo ${file.name} excede 8MB.` }, { status: 400 });
    }
  }

  const client = await db.connect();

  try {
    await client.query("begin");
    const observation = await client.query(
      `
        insert into public.user_observations (user_id, subject, body)
        values ($1, $2, $3)
        returning id
      `,
      [user.id, subject, body]
    );

    const observationId = observation.rows[0].id;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await client.query(
        `
          insert into public.observation_attachments (observation_id, file_name, content_type, file_size, data)
          values ($1, $2, $3, $4, $5)
        `,
        [observationId, file.name, file.type || "application/octet-stream", file.size, buffer]
      );
    }

    await client.query("commit");
    return NextResponse.json({ id: observationId }, { status: 201 });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "Falha ao enviar observacao." }, { status: 500 });
  } finally {
    client.release();
  }
}
