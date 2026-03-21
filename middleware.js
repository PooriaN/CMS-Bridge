import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'cmsb_session';
const SESSION_VERSION = 'v1';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET?.trim() || '';
}

function isAuthConfigured() {
  return Boolean(process.env.APP_PASSWORD?.trim()) && Boolean(getSessionSecret());
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signPayload(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(signature);
}

async function hasValidSession(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [version, issuedAtRaw, signature] = parts;
  if (version !== SESSION_VERSION) return false;

  const issuedAt = Number(issuedAtRaw);
  const now = Date.now();
  if (!Number.isFinite(issuedAt)) return false;
  if (issuedAt > now + 5 * 60 * 1000) return false;
  if (now - issuedAt > SESSION_TTL_MS) return false;

  const expected = await signPayload(`${version}.${issuedAtRaw}`, secret);
  return signature === expected;
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const loginPath = pathname === '/login' || pathname === '/login.html';
  const publicPath = pathname === '/api/health' || pathname === '/api/login' || pathname === '/api/logout';
  const isApi = pathname.startsWith('/api/');

  if (!isAuthConfigured()) {
    if (!isProductionLike() || pathname === '/api/health') {
      return NextResponse.next();
    }

    if (isApi) {
      return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 });
    }

    return new NextResponse(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Authentication Unavailable</title></head><body style="font-family:system-ui,sans-serif;background:#0a0a0f;color:#e4e4ef;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:420px;padding:32px;border:1px solid #2a2a3a;border-radius:12px;background:#13131a"><h1 style="margin-top:0">Authentication unavailable</h1><p style="color:#a5a5bd;line-height:1.5">This deployment is missing APP_PASSWORD or APP_SESSION_SECRET, so access is blocked until authentication is configured.</p></main></body></html>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  if (publicPath) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await hasValidSession(token, getSessionSecret());

  if (pathname === '/logout') {
    return NextResponse.rewrite(new URL('/api/logout', request.url));
  }

  if (loginPath) {
    if (authenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (pathname === '/login') {
      return NextResponse.rewrite(new URL(`/login.html${search}`, request.url));
    }
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname && pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/login.html', '/((?!_next|.*\\..*).*)', '/api/:path*'],
};
