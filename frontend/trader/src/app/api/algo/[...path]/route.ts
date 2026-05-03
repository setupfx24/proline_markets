import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies /api/algo/* → gateway /api/algo/*.
 * Algo trade endpoint uses X-Api-Key / X-Api-Secret headers (no JWT).
 */
function gatewayOrigin(): string {
  const explicit =
    process.env.TRADER_API_PROXY_TARGET?.trim() ||
    process.env.GATEWAY_URL?.trim();
  if (explicit) return String(explicit).replace(/\/$/, '');

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
  if (fallback) return String(fallback).replace(/\/$/, '');

  return 'http://127.0.0.1:8000';
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const sub = segments.length ? segments.join('/').replace(/\/+$/, '') : '';
  const path = sub ? `api/algo/${sub}` : 'api/algo';
  const targetUrl = `${gatewayOrigin()}/${path}${req.nextUrl.search}`.replace(/([^:])\/\//g, '$1/');

  const headers = new Headers();
  // Forward algo auth headers
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) headers.set('x-api-key', apiKey);
  const apiSecret = req.headers.get('x-api-secret');
  if (apiSecret) headers.set('x-api-secret', apiSecret);
  // Forward standard headers
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const incomingCt = req.headers.get('content-type');
  if (incomingCt) headers.set('content-type', incomingCt);
  const ua = req.headers.get('user-agent');
  if (ua) headers.set('user-agent', ua);
  const xff = req.headers.get('x-forwarded-for');
  if (xff) headers.set('x-forwarded-for', xff);
  const xri = req.headers.get('x-real-ip');
  if (xri) headers.set('x-real-ip', xri);
  const origin = req.headers.get('origin');
  if (origin) headers.set('origin', origin);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body: BodyInit | undefined;
  if (hasBody) {
    try {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 0) body = Buffer.from(buf);
    } catch {
      body = undefined;
    }
  }

  let res: Response;
  try {
    res = await fetch(targetUrl, { method, headers, body, redirect: 'manual' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    console.error('[api/algo proxy]', targetUrl, msg);
    return NextResponse.json(
      { detail: 'Cannot reach API gateway. Proxy target: ' + gatewayOrigin() },
      { status: 502 },
    );
  }

  if ([301, 302, 307, 308].includes(res.status)) {
    const location = res.headers.get('location');
    if (location) {
      try {
        const redirectUrl = new URL(location, targetUrl).toString();
        res = await fetch(redirectUrl, { method, headers, body, redirect: 'manual' });
      } catch {
        return NextResponse.json({ detail: 'Gateway redirect failed' }, { status: 502 });
      }
    }
  }

  const out = new Headers();
  const ctOut = res.headers.get('content-type');
  if (ctOut) out.set('content-type', ctOut);
  for (const h of ['access-control-allow-origin', 'access-control-allow-credentials',
                   'access-control-allow-methods', 'access-control-allow-headers',
                   'access-control-max-age', 'vary']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
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
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}
export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await segmentsFromCtx(ctx));
}
