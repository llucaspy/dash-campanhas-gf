import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, type AppUser, type UserRole } from "../../../../../lib/db";
import { hashPassword } from "../../../../../lib/password";
import { isAdmin, SESSION_COOKIE, verifySessionToken } from "../../../../../lib/session";

async function requireAdmin() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return isAdmin(user) ? user : null;
}

function normalizeRole(role: unknown): UserRole {
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const fields: string[] = [];
  const values: unknown[] = [];

  const push = (sql: string, value: unknown) => {
    values.push(value);
    fields.push(`${sql} = $${values.length}`);
  };

  if (body.name !== undefined) push("name", String(body.name).trim());
  if (body.username !== undefined) push("username", String(body.username).trim());
  if (body.email !== undefined) push("email", String(body.email).trim());
  if (body.role !== undefined) push("role", normalizeRole(body.role));
  if (body.active !== undefined) push("active", Boolean(body.active));
  if (body.password) push("password_hash", hashPassword(String(body.password)));

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração enviada." }, { status: 400 });
  }

  values.push(id);
  const result = await db.query<AppUser>(
    `
      update public.app_users
      set ${fields.join(", ")}, updated_at = now()
      where id = $${values.length}
      returning id, name, username, email, role, active, created_at, updated_at
    `,
    values
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ user: result.rows[0] });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  if (id === admin.id) {
    return NextResponse.json({ error: "Você não pode remover seu próprio usuário." }, { status: 400 });
  }

  const result = await db.query("delete from public.app_users where id = $1 returning id", [id]);
  if (!result.rows[0]) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
