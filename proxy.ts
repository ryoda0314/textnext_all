import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

// Reachable without signing in.
const PUBLIC_PATHS = ["/welcome", "/login", "/signup", "/reset-password", "/terms", "/privacy", "/contact", "/offline"];
// Signed-in members are sent home from these.
const GUEST_ONLY_PATHS = ["/welcome", "/login", "/signup"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT and refreshes the session cookie when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && !matches(path, PUBLIC_PATHS)) {
    if (path === "/") return redirectTo("/welcome");
    return redirectTo("/login", `?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }

  if (signedIn && matches(path, GUEST_ONLY_PATHS)) {
    // Mid-sign-up (verifying the email code) stays on /signup.
    if (path.startsWith("/signup") && request.nextUrl.searchParams.has("verify")) return response;
    return redirectTo("/");
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals and static files.
    "/((?!api/|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)",
  ],
};
