import { NextResponse } from "next/server";

import { requireRequestUser } from "../../../../lib/apiAuth";
import { gamHeaders, gamUrl } from "../../../../lib/gamProxy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const payload = await request.json().catch(() => ({}));

  try {
    const upstream = await fetch(gamUrl("/api/generate-report"), {
      method: "POST",
      cache: "no-store",
      headers: gamHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Servico GAM indisponivel. Inicie o extrator em http://127.0.0.1:5000.",
      },
      { status: 503 }
    );
  }
}
