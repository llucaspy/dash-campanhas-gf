import { NextResponse } from "next/server";
import { requireRequestUser } from "../../../lib/apiAuth";
import { getVapidPublicKey, removePushSubscription, savePushSubscription } from "../../../lib/pushNotifications";

export async function GET() {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ error: "Push ainda nao configurado." }, { status: 503 });
  }

  return NextResponse.json({ publicKey });
}

export async function POST(request: Request) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const { subscription } = await request.json().catch(() => ({}));
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Inscricao invalida." }, { status: 400 });
  }

  await savePushSubscription({
    userId: user.id,
    subscription,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const { endpoint } = await request.json().catch(() => ({}));
  await removePushSubscription(String(endpoint || ""));

  return NextResponse.json({ ok: true });
}
