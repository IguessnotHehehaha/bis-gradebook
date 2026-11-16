import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEV_COOKIE, devFakeAuth, supabaseEnv } from "@/lib/env";

/** Keeps the Supabase session fresh and sends signed-out visitors to /login. */
export async function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (devFakeAuth()) {
    if (!request.cookies.get(DEV_COOKIE)?.value && !isLogin) return toLogin();
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !isLogin) return toLogin();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
