import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies /api/v1/* → gateway. More reliable than next.config rewrites on some Windows setups.
 *
 * Priority: TRADER_API_PROXY_TARGET | GATEWAY_URL | INTERNAL_API_URL (strip /api/v1) | NEXT_PUBLIC_GATEWAY_ORIGIN | localhost.
 * Docker Compose sets INTERNAL_API_URL=http://gateway:8000/api/v1 — that must be honored here.
 */
function gatewayOrigin(): string {
  const explicit =
    process.env.TRADER_API_PROXY_TARGET?.trim() ||
    process.env.GATEWAY_URL?.trim();
  if (explicit) {
    return String(explicit).replace(/\/$/, '');
  }

  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) {
    const base = internal.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
    if (base) {
      try {
        const u = new URL(base);
        const path = u.pathname.replace(/\/$/, '');
        return path ? `${u.origin}${path}` : u.origin;
      } catch {
        return base;
      }
    }
  }

  const fallback = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim();
  if (fallback) {
    return String(fallback).replace(/\/$/, '');
  }

  return 'http://127.0.0.1:8000';
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const subRaw = segments.length ? segments.join('/') : '';
  /** FastAPI routes are registered without a trailing slash; a trailing slash here causes 307 redirects that break multipart POST replay. */
  const sub = subRaw.replace(/\/+$/, '');
  const path = sub ? `api/v1/${sub}` : 'api/v1';
  const targetUrl = `${gatewayOrigin()}/${path}${req.nextUrl.search}`.replace(/([^:])\/\//g, '$1/');

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const incomingCt = req.headers.get('content-type');
  // Preserve real client metadata for gateway (KYC, audit logs, sessions). Node fetch defaults to User-Agent "node".
  const ua = req.headers.get('user-agent');
  if (ua) headers.set('user-agent', ua);
  const xff = req.headers.get('x-forwarded-for');
  if (xff) headers.set('x-forwarded-for', xff);
  const xri = req.headers.get('x-real-ip');
  if (xri) headers.set('x-real-ip', xri);
  /* Forward CORS preflight headers so the gateway's CORSMiddleware can
     recognize cross-origin calls from the algo subdomain etc. Without
     Origin, FastAPI falls through to the router and returns 405 on OPTIONS. */
  const origin = req.headers.get('origin');
  if (origin) headers.set('origin', origin);
  const acrm = req.headers.get('access-control-request-method');
  if (acrm) headers.set('access-control-request-method', acrm);
  const acrh = req.headers.get('access-control-request-headers');
  if (acrh) headers.set('access-control-request-headers', acrh);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body: BodyInit | undefined;
  if (hasBody) {
    const isMultipart = incomingCt?.toLowerCase().includes('multipart/form-data');
    if (isMultipart) {
      try {
        const incoming = await req.formData();
        const outgoing = new FormData();
        for (const [key, value] of incoming.entries()) {
          if (value instanceof File) {
            outgoing.append(key, value, value.name || 'upload');
          } else {
            outgoing.append(key, value as string);
          }
        }
        body = outgoing;
      } catch (e) {
        console.error('[api/v1 proxy] multipart formData', e);
        return NextResponse.json(
          { detail: 'Could not read file upload. Try a smaller image (JPG/PNG) under 10 MB.' },
          { status: 400 },
        );
      }
    } else {
      if (incomingCt) headers.set('content-type', incomingCt);
      try {
        const buf = await req.arrayBuffer();
        if (buf.byteLength > 0) {
          body = Buffer.from(buf);
        }
      } catch {
        body = undefined;
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    console.error('[api/v1 proxy]', targetUrl, msg);
    return NextResponse.json(
      {
        detail:
          'Cannot reach API gateway. Run: docker compose up -d (or start gateway on port 8000). ' +
          `Proxy target: ${gatewayOrigin()}`,
      },
      { status: 502 },
    );
  }

  // If gateway returned a redirect (307/308), follow it manually preserving body + auth.
  if ([301, 302, 307, 308].includes(res.status)) {
    const location = res.headers.get('location');
    if (location) {
      try {
        const redirectUrl = new URL(location, targetUrl).toString();
        res = await fetch(redirectUrl, { method, headers, body, redirect: 'manual' });
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : 'redirect fetch failed';
        console.error('[api/v1 proxy redirect]', location, msg);
        return NextResponse.json({ detail: 'Gateway redirect failed' }, { status: 502 });
      }
    }
  }

  const out = new Headers();
  const ctOut = res.headers.get('content-type');
  if (ctOut) out.set('content-type', ctOut);
  /* Forward CORS headers from gateway — without these, browser preflight and
     cross-origin responses fail for callers like algo.ProlineMarketsfx.com. */
  for (const h of ['access-control-allow-origin', 'access-control-allow-credentials',
                   'access-control-allow-methods', 'access-control-allow-headers',
                   'access-control-expose-headers', 'access-control-max-age', 'vary']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  const setCookies =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    for (const c of setCookies) {
      out.append('set-cookie', c);
    }
  } else {
    const single = res.headers.get('set-cookie');
    if (single) out.append('set-cookie', single);
  }

  return new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function segmentsFromCtx(ctx: RouteCtx): Promise<string[]> {
  const p = await ctx.params;
  return p.path ?? [];
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}

export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}
