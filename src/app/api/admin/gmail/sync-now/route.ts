import { NextResponse } from "next/server";

import { requireRequestUser } from "../../../../../lib/apiAuth";
import { syncGmailIntelligenceNow } from "../../../../../lib/gmail/intelligence";
import { isLucasAccount } from "../../../../../lib/lucasAccess";

export async function POST() {
  const user = await requireRequestUser().catch(() => null);
  if (!isLucasAccount(user)) {
    return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
  }

  try {
    const result = await syncGmailIntelligenceNow();
    return NextResponse.json({
      ok: true,
      ...result,
      message: `Gmail sincronizado: ${result.matched} alerta(s) encontrado(s) em ${result.inspected} email(s) analisado(s).`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel sincronizar o Gmail." },
      { status: 500 }
    );
  }
}
