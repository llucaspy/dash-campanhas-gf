import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";
import { ensurePasswordPolicyColumn } from "../../../../lib/userSecurity";

export async function POST() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  await ensurePasswordPolicyColumn();
  await db.query("update public.app_users set has_seen_welcome = true, updated_at = now() where id = $1", [user.id]);

  return NextResponse.json({ ok: true });
}
