import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies /admin-api/* → admin-api service at /api/v1/admin/*.
 * Set ADMIN_API_PROXY_TARGET (e.g. http://admin-api:8001 in Docker, http://127.0.0.1:8001 locally).
 */
function adminApiOrigin(): string {
  const raw =
    process.env.ADMIN_API_PROXY_TARGET ||
    process.env.ADMIN_API_INTERNAL_URL ||
    'http://127.0.0.1:8001';
  return String(raw).replace(/\/$/, '');
}

async function segmentsFromParams(params: Promise<{ path?: string[] }>): Promise<string[]> {
  const p = await params;
  return p.path ?? [];
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const sub = segments.length ? segments.join('/') : '';
  const path = sub ? `api/v1/admin/${sub}` : 'api/v1/admin';
  const targetUrl = `${adminApiOrigin()}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = undefined;
    }
  }

  const ctrl =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(120_000)
      : undefined;

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      signal: ctrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    console.error('[admin-api proxy]', targetUrl, msg);
    return NextResponse.json(
      {
        detail:
          'Cannot reach admin API. Ensure admin-api is running and ADMIN_API_PROXY_TARGET is correct. ' +
          `Target: ${adminApiOrigin()}`,
      },
      { status: 502 },
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    console.error('[admin-api proxy] response body', targetUrl, msg);
    return NextResponse.json({ detail: 'Failed to read admin API response' }, { status: 502 });
  }

  const out = new Headers();
  const ctOut = res.headers.get('content-type');
  if (ctOut) out.set('content-type', ctOut);

  return new NextResponse(buf, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function safeProxy(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  try {
    const segments = await segmentsFromParams(ctx.params);
    return await proxy(req, segments);
  } catch (e) {
    console.error('[admin-api proxy] unhandled', e);
    return NextResponse.json({ detail: 'Admin API proxy error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}
