import { NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { requireRequestUser } from "../../../../../../lib/apiAuth";
import { isAdmin } from "../../../../../../lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRequestUser().catch(() => null);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  const { id } = await context.params;
  const { status } = await request.json().catch(() => ({}));
  const normalized = ["open", "reviewed", "resolved"].includes(status) ? status : "open";

  const result = await db.query(
    `
      update public.user_observations
      set status = $1, updated_at = now()
      where id = $2
      returning id, status
    `,
    [normalized, id]
  );

  return NextResponse.json({ observation: result.rows[0] });
}
