import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, type AppUser } from "../../../../lib/db";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";
import { ensurePasswordPolicyColumn } from "../../../../lib/userSecurity";

export async function GET() {
  const cookieStore = await cookies();
  const user = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!user) {
    return NextResponse.json({ user: null });
  }

  await ensurePasswordPolicyColumn();

  const result = await db.query<AppUser>(
    `
      select must_change_password, has_seen_welcome
      from public.app_users
      where id = $1
      limit 1
    `,
    [user.id]
  );
  const dbUser = result.rows[0];

  return NextResponse.json({
    user: {
      ...user,
      mustChangePassword: Boolean(dbUser?.must_change_password),
      hasSeenWelcome: Boolean(dbUser?.has_seen_welcome),
    },
  });
}
