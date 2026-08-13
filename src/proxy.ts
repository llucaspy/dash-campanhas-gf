import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";
import { isLucasAccount } from "./lib/lucasAccess";

const adminRoutes = ["/settings", "/requests", "/assistant", "/campaigns/create", "/campaigns/edit"];
const adminApiRoutes = ["/api/admin"];
const lucasRoutes = ["/acompanhamento"];
const lucasApiRoutes = ["/api/lucas"];
const authRoutes: string[] = [];

function matches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAdmin = matches(pathname, adminRoutes) || matches(pathname, adminApiRoutes);
  const requiresLucas = matches(pathname, lucasRoutes) || matches(pathname, lucasApiRoutes);
  const requiresAuth = matches(pathname, authRoutes);

  if (!requiresAdmin && !requiresLucas && !requiresAuth) return NextResponse.next();

  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  if (requiresAdmin && user.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("denied", "admin");
    return NextResponse.redirect(url);
  }

  if (requiresLucas && !isLucasAccount(user)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Acesso reservado ao Lucas." }, { status: 403 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("denied", "lucas");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/assistant/:path*", "/settings/:path*", "/requests/:path*", "/acompanhamento/:path*", "/campaigns/create", "/campaigns/edit/:path*", "/api/admin/:path*", "/api/lucas/:path*"],
};
