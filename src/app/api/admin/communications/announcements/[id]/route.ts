import { NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { requireRequestUser } from "../../../../../../lib/apiAuth";
import { isAdmin } from "../../../../../../lib/session";

async function canAdmin() {
  const user = await requireRequestUser();
  return isAdmin(user);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await canAdmin().catch(() => false))) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const result = await db.query(
    `
      update public.global_announcements
      set active = coalesce($1, active),
          priority = coalesce($2, priority),
          updated_at = now()
      where id = $3
      returning id, title, body, priority, active, created_at
    `,
    [body.active, body.priority === "important" || body.priority === "normal" ? body.priority : null, id]
  );

  return NextResponse.json({ announcement: result.rows[0] });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await canAdmin().catch(() => false))) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  await db.query("delete from public.global_announcements where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
