import { NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { requireRequestUser } from "../../../../../lib/apiAuth";
import { isAdmin } from "../../../../../lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const { id } = await context.params;
  const result = await db.query(
    `
      select att.file_name, att.content_type, att.data, o.user_id
      from public.observation_attachments att
      join public.user_observations o on o.id = att.observation_id
      where att.id = $1
      limit 1
    `,
    [id]
  );

  const attachment = result.rows[0];
  if (!attachment) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  if (!isAdmin(user) && attachment.user_id !== user.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const bytes = attachment.data instanceof Buffer ? attachment.data : Buffer.from(attachment.data);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.content_type,
      "Content-Disposition": `attachment; filename="${String(attachment.file_name).replace(/"/g, "")}"`,
    },
  });
}
