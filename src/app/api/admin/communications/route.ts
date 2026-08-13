import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { requireRequestUser } from "../../../../lib/apiAuth";
import { getCommunicationsEnabled, getSponsorshipEmailAlertSettings, getUserInformationLevel } from "../../../../lib/appSettings";
import { isAdmin } from "../../../../lib/session";
import { sendPushNotification } from "../../../../lib/pushNotifications";

async function requireAdminUser() {
  const user = await requireRequestUser();
  if (!isAdmin(user)) throw new Error("FORBIDDEN");
  return user;
}

export async function GET() {
  const user = await requireAdminUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });

  const announcements = await db.query(
    `
      select a.id, a.title, a.body, a.priority, a.active, a.created_at, a.campaign_id, a.boost_status,
        u.name as author_name,
        c.pi_number as campaign_pi,
        c.name as campaign_name,
        c.dashboard_url as campaign_dashboard_url,
        c.gam_link as campaign_gam_link
      from public.global_announcements a
      left join public.app_users u on u.id = a.created_by
      left join public.campaigns c on c.id = a.campaign_id
      order by a.created_at desc
      limit 20
    `
  );

  const observations = await db.query(
    `
      select o.id, o.subject, o.body, o.status, o.created_at,
        u.name as user_name, u.email as user_email,
        coalesce(json_agg(json_build_object(
          'id', att.id,
          'fileName', att.file_name,
          'fileSize', att.file_size,
          'contentType', att.content_type
        )) filter (where att.id is not null), '[]') as attachments
      from public.user_observations o
      join public.app_users u on u.id = o.user_id
      left join public.observation_attachments att on att.observation_id = o.id
      group by o.id, u.name, u.email
      order by o.created_at desc
      limit 30
    `
  );

  const communicationsEnabled = await getCommunicationsEnabled();
  const userInformationLevel = await getUserInformationLevel();
  const sponsorshipEmailAlerts = await getSponsorshipEmailAlertSettings();

  return NextResponse.json({ announcements: announcements.rows, observations: observations.rows, communicationsEnabled, userInformationLevel, sponsorshipEmailAlerts });
}

export async function POST(request: Request) {
  const user = await requireAdminUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });

  const { title, body, priority = "normal", active = true, campaignId = null, boostStatus = "normal" } = await request.json().catch(() => ({}));

  if (!String(title || "").trim() || !String(body || "").trim()) {
    return NextResponse.json({ error: "Informe título e comunicado." }, { status: 400 });
  }

  const normalizedBoostStatus = ["sponsorship", "high", "normal", "low"].includes(boostStatus) ? boostStatus : "normal";
  const normalizedCampaignId = campaignId ? String(campaignId) : null;

  const result = await db.query(
    `
      insert into public.global_announcements (title, body, priority, active, created_by, campaign_id, boost_status)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, title, body, priority, active, created_at, campaign_id, boost_status
    `,
    [
      String(title).trim(),
      String(body).trim(),
      priority === "important" || normalizedBoostStatus === "sponsorship" ? "important" : "normal",
      Boolean(active),
      user.id,
      normalizedCampaignId,
      normalizedBoostStatus,
    ]
  );

  const announcement = result.rows[0];

  sendPushNotification(
    {
      title: normalizedBoostStatus === "sponsorship" ? "Patrocinio ativo" : "Novo comunicado",
      body: `${String(title).trim()}: ${String(body).trim().slice(0, 120)}${String(body).trim().length > 120 ? "..." : ""}`,
      url: "/",
      tag: normalizedBoostStatus === "sponsorship" ? `sponsorship-${announcement.id}` : `announcement-${announcement.id}`,
      requireInteraction: normalizedBoostStatus === "sponsorship",
    },
    normalizedBoostStatus === "sponsorship" ? "admins" : "all"
  ).catch((error) => console.error("Falha ao enviar push do comunicado", error));

  return NextResponse.json({ announcement }, { status: 201 });
}
