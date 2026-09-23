import { NextRequest, type NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18nRouting = createIntlMiddleware(routing);

/**
 * Origins allowed to embed this app in a frame. The legacy app was displayed inside the
 * Lanka Gate country portal, so that origin is the default; override with FRAME_ANCESTORS.
 */
const DEFAULT_FRAME_ANCESTORS = "'self' https://cp.lankagate.gov.lk";

function buildCsp(nonce: string, isHttps: boolean): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const frameAncestors = (process.env.FRAME_ANCESTORS ?? DEFAULT_FRAME_ANCESTORS).trim();
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonce-approved Next.js bootstrap load its own chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes (React `style` props) cannot carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    // Only tell the browser to upgrade sub-resource requests when we're actually reachable over
    // HTTPS (directly, or via a proxy that sets X-Forwarded-Proto). Sending this to a client that
    // hit us over plain HTTP - e.g. testing straight against the app's internal port - makes every
    // asset request rewrite itself to https:// on a port with no TLS listener and fail outright.
    ...(!isDev && isHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

function isHttpsRequest(request: NextRequest): boolean {
  return request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:';
}

export default function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const isHttps = isHttpsRequest(request);
  const csp = buildCsp(nonce, isHttps);

  // Next.js reads the nonce from the *request's* CSP header and stamps it on its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = handleI18nRouting(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set('content-security-policy', csp);
  if (isHttps) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  return response;
}

export const config = {
  // Everything except Next internals and files with an extension (images, favicon, ...).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
