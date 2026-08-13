import { NextResponse } from "next/server";
import { getAssistantEnabled, getCommunicationsEnabled, getUserInformationLevel } from "../../../lib/appSettings";
import { requireRequestUser } from "../../../lib/apiAuth";

export async function GET() {
  const user = await requireRequestUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });

  const communicationsEnabled = await getCommunicationsEnabled();
  const userInformationLevel = await getUserInformationLevel();
  const assistantEnabled = await getAssistantEnabled();
  return NextResponse.json({ communicationsEnabled, userInformationLevel, assistantEnabled });
}
