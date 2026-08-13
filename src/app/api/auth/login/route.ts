import { NextResponse } from "next/server";
import { db, type AppUser } from "../../../../lib/db";
import { verifyPassword } from "../../../../lib/password";
import { createSessionToken, SESSION_COOKIE } from "../../../../lib/session";
import { ensurePasswordPolicyColumn } from "../../../../lib/userSecurity";

export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({}));

  if (!username || !password) {
    return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
  }

  await ensurePasswordPolicyColumn();

  const result = await db.query<AppUser>(
    `
      select id, name, username, email, password_hash, role, active, must_change_password, has_seen_welcome
      from public.app_users
      where lower(username) = lower($1) or lower(email) = lower($1)
      limit 1
    `,
    [String(username).trim()]
  );

  const user = result.rows[0];

  if (!user || !user.active || !user.password_hash || !verifyPassword(String(password), user.password_hash)) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
  const token = await createSessionToken(sessionUser);
  const response = NextResponse.json({
    user: {
      ...sessionUser,
      mustChangePassword: Boolean(user.must_change_password),
      hasSeenWelcome: Boolean(user.has_seen_welcome),
    },
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
