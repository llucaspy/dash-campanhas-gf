import { NextResponse } from "next/server";

import { requireRequestUser } from "../../../../../lib/apiAuth";
import { gamHeaders, gamUrl } from "../../../../../lib/gamProxy";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const { filename } = await context.params;

  try {
    const upstream = await fetch(gamUrl(`/api/download/${encodeURIComponent(filename)}`), { cache: "no-store", headers: gamHeaders() });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Arquivo nao encontrado no servico GAM." }, { status: upstream.status });
    }

    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": upstream.headers.get("content-disposition") || `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Servico GAM indisponivel. Inicie o extrator em http://127.0.0.1:5000.",
      },
      { status: 503 }
    );
  }
}
