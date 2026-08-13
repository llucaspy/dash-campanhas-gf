import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateTemporaryPassword, getAppUrl, sendAccessEmail } from "../../../../../lib/accessEmail";
import { db, type AppUser } from "../../../../../lib/db";
import { hashPassword } from "../../../../../lib/password";
import { isAdmin, SESSION_COOKIE, verifySessionToken } from "../../../../../lib/session";
import { ensurePasswordPolicyColumn } from "../../../../../lib/userSecurity";

type InviteTarget = Pick<AppUser, "id" | "name" | "username" | "email" | "active" | "role">;

interface InviteResult {
  userId: string;
  name: string;
  email: string;
  ok: boolean;
  error?: string;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return isAdmin(user) ? user : null;
}

function hasDeliverableEmail(user: InviteTarget) {
  return Boolean(user.email && !user.email.toLowerCase().endsWith("@dashboard.local"));
}

function getFriendlyEmailError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Falha ao enviar acesso.";
  const message = raw.toLowerCase();

  if (message.includes("invalid login") || message.includes("535") || message.includes("authentication")) {
    return "Falha na autenticação SMTP. Verifique se a senha de app do email ainda está válida.";
  }

  if (message.includes("daily") || message.includes("quota") || message.includes("limit")) {
    return "O servidor de email recusou por limite de envio. Tente novamente mais tarde ou reduza o lote.";
  }

  if (message.includes("recipient") || message.includes("address")) {
    return "O email do destinatário parece inválido.";
  }

  return raw;
}

async function loadTargets(userId?: string) {
  if (userId) {
    const result = await db.query<InviteTarget>(
      `
        select id, name, username, email, active, role
        from public.app_users
        where id = $1
        limit 1
      `,
      [userId]
    );
    return result.rows;
  }

  const result = await db.query<InviteTarget>(
    `
      select id, name, username, email, active, role
      from public.app_users
      where role = 'USER'
        and active = true
        and email is not null
        and email <> ''
        and lower(email) not like '%@dashboard.local'
      order by name asc
    `
  );
  return result.rows;
}

async function inviteUser(user: InviteTarget, appUrl: string): Promise<InviteResult> {
  if (!user.active) {
    return { userId: user.id, name: user.name, email: user.email, ok: false, error: "Usuário inativo." };
  }

  if (!hasDeliverableEmail(user)) {
    return { userId: user.id, name: user.name, email: user.email, ok: false, error: "Usuário sem email válido." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const client = await db.connect();

  try {
    await client.query("begin");
    await client.query("update public.app_users set password_hash = $1, must_change_password = true, has_seen_welcome = false, updated_at = now() where id = $2", [
      hashPassword(temporaryPassword),
      user.id,
    ]);

    await sendAccessEmail({
      to: user.email,
      name: user.name,
      username: user.username,
      password: temporaryPassword,
      appUrl,
    });

    await client.query("commit");
    return { userId: user.id, name: user.name, email: user.email, ok: true };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    return { userId: user.id, name: user.name, email: user.email, ok: false, error: getFriendlyEmailError(error) };
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  await ensurePasswordPolicyColumn();

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const targets = await loadTargets(userId);

  if (userId && !targets[0]) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (!targets.length) {
    return NextResponse.json({ error: "Nenhum usuário ativo com email válido para envio." }, { status: 400 });
  }

  const appUrl = getAppUrl();
  const results: InviteResult[] = [];

  for (const target of targets) {
    results.push(await inviteUser(target, appUrl));
  }

  const sent = results.filter((result) => result.ok).length;
  const failed = results.length - sent;
  const status = sent > 0 ? 200 : 400;

  return NextResponse.json({ sent, failed, results }, { status });
}
