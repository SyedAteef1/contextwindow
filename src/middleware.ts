import { NextResponse, type NextRequest } from "next/server";

/**
 * Which site is this.
 *
 * One deployment answers on two hostnames: the apex is the public site, and the
 * subdomain is the product. Splitting them means a stranger never lands on an
 * app route, and a signed-in rep never lands on a sales pitch.
 *
 * The decision is made here rather than in each page because it depends on the
 * Host header, and a page that reads headers cannot be statically rendered —
 * doing it once at the edge keeps that cost in one place.
 *
 * Cookie presence is enough for a redirect. It is deliberately *not* treated as
 * proof of anything: every protected route still calls `requireUser`, which
 * verifies the signature. A forged cookie gets you a redirect to a page that
 * then throws you out.
 */
const SESSION_COOKIE = "si_session";

/** Paths the public site owns. Everything else there belongs to the app. */
const MARKETING_PATHS = new Set(["/", "/privacy", "/terms"]);

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const marketingHost = hostOf(process.env.MARKETING_URL);
  const appHost = hostOf(process.env.APP_URL);

  // Same origin for both, or misconfigured: behave exactly as before.
  if (!marketingHost || !appHost || marketingHost === appHost) return NextResponse.next();

  const host = request.headers.get("host");
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // One canonical public host. `www` is answered so a certificate exists and a
  // typed address resolves, but it redirects rather than serving a second copy
  // — two hostnames serving identical pages splits search ranking and makes an
  // absolute link ambiguous.
  if (host === `www.${marketingHost}`) {
    return NextResponse.redirect(new URL(pathname + search, process.env.MARKETING_URL));
  }

  // Shared by both sites: auth has to complete wherever it started, the demo
  // form posts from the public site, and static assets are not routable.
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/demo-requests") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (host === marketingHost) {
    // A signed-in visitor asking for the pitch wants their meetings.
    if (signedIn && MARKETING_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL("/meetings", process.env.APP_URL));
    }
    // Anything that is not a marketing page lives on the app host.
    if (!MARKETING_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL(pathname + search, process.env.APP_URL));
    }
    return NextResponse.next();
  }

  if (host === appHost) {
    // A signed-in rep asking for the pitch wants their meetings.
    if (signedIn && MARKETING_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL("/meetings", process.env.APP_URL));
    }
    // Everything else is served here, including the landing page.
    //
    // Sending a stranger from the app host to the public host would be tidier,
    // but it makes this deployment depend on the other hostname already
    // resolving here — and during a DNS move it does not, so the redirect
    // lands them on whatever the old records still point at. Serving the page
    // on both hosts is correct before and after the move, and costs only that
    // the page has two addresses.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets, which never need routing.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
