import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function getRequestUser() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireRequestUser() {
  const user = await getRequestUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
