import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, type AppUser, type UserRole } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/password";
import { isAdmin, SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";

async function requireAdmin() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return isAdmin(user) ? user : null;
}

function normalizeRole(role: unknown): UserRole {
  return role === "ADMIN" ? "ADMIN" : "USER";
}

function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, ".").toLowerCase();
}

function getInternalEmail(username: string) {
  const safeUsername = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "") || `user-${Date.now()}`;
  return `${safeUsername}@dashboard.local`;
}

function getDbErrorMessage(error: unknown) {
  const dbError = error as { code?: string; constraint?: string };

  if (dbError.code === "23505") {
    if (dbError.constraint === "app_users_username_key") return "Este usuário já está cadastrado.";
    if (dbError.constraint === "app_users_email_key") return "Este email já está cadastrado.";
    return "Já existe um acesso cadastrado com esses dados.";
  }

  return "Não consegui criar o usuário agora. Tente novamente em instantes.";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const result = await db.query<AppUser>(
    `
      select id, name, username, email, role, active, created_at, updated_at
      from public.app_users
      order by created_at desc
    `
  );

  return NextResponse.json({ users: result.rows });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const username = normalizeUsername(String(body.username || ""));
  const email = String(body.email || "").trim().toLowerCase() || getInternalEmail(username);
  const password = String(body.password || "");
  const role = normalizeRole(body.role);
  const active = body.active !== false;

  if (!name || !username || password.length < 6) {
    return NextResponse.json({ error: "Preencha nome, usuário e senha com no mínimo 6 caracteres." }, { status: 400 });
  }

  const existing = await db.query<AppUser>(
    `
      select id, username, email
      from public.app_users
      where lower(username) = lower($1) or lower(email) = lower($2)
      limit 1
    `,
    [username, email]
  );

  if (existing.rows[0]) {
    const duplicatedUsername = existing.rows[0].username.toLowerCase() === username.toLowerCase();
    return NextResponse.json({ error: duplicatedUsername ? "Este usuário já está cadastrado." : "Este email já está cadastrado." }, { status: 409 });
  }

  try {
    const result = await db.query<AppUser>(
      `
        insert into public.app_users (name, username, email, password_hash, role, active)
        values ($1, $2, $3, $4, $5, $6)
        returning id, name, username, email, role, active, created_at, updated_at
      `,
      [name, username, email, hashPassword(password), role, active]
    );

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getDbErrorMessage(error) }, { status: 400 });
  }
}
