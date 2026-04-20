import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

const AUTH_PAGES = ['/login'];
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/api/public'];

function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(fr|en|de|ar)(\/.*|$)/);
  return m ? m[2] || '/' : pathname;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const localeStripped = stripLocale(path);

  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return response;

  const isAuthPage = AUTH_PAGES.some((p) => localeStripped.startsWith(p));

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    const localeMatch = path.match(/^\/(fr|en|de|ar)(\/.*|$)/);
    const locale = localeMatch?.[1] ?? 'fr';
    url.pathname = `/${locale}/login`;
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    const localeMatch = path.match(/^\/(fr|en|de|ar)(\/.*|$)/);
    const locale = localeMatch?.[1] ?? 'fr';
    url.pathname = `/${locale}`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
