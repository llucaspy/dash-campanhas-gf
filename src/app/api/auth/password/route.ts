import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, type AppUser } from "../../../../lib/db";
import { hashPassword, verifyPassword } from "../../../../lib/password";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";
import { ensurePasswordPolicyColumn } from "../../../../lib/userSecurity";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionUser = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!sessionUser) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Informe a senha atual e a nova senha." }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "A nova senha precisa ter no mínimo 8 caracteres." }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "A nova senha precisa ser diferente da senha atual." }, { status: 400 });
  }

  await ensurePasswordPolicyColumn();

  const result = await db.query<AppUser>(
    `
      select id, password_hash, active
      from public.app_users
      where id = $1
      limit 1
    `,
    [sessionUser.id]
  );
  const user = result.rows[0];

  if (!user || !user.active || !user.password_hash || !verifyPassword(currentPassword, user.password_hash)) {
    return NextResponse.json({ error: "Senha atual inválida." }, { status: 401 });
  }

  await db.query(
    `
      update public.app_users
      set password_hash = $1,
          must_change_password = false,
          updated_at = now()
      where id = $2
    `,
    [hashPassword(newPassword), sessionUser.id]
  );

  return NextResponse.json({ ok: true });
}
