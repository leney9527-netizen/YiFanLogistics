import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";

const handleI18n = createIntlMiddleware(routing);

function isPrivatePath(pathname: string): boolean {
  return (
    /^\/(zh|en|fr)\/(account|admin)(\/|$)/.test(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/account") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/quotes") ||
    pathname.startsWith("/api/inquiries") ||
    pathname.startsWith("/api/cron")
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = pathname.startsWith("/api") ? NextResponse.next() : handleI18n(request);
  await refreshSession(request, response);
  if (isPrivatePath(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
