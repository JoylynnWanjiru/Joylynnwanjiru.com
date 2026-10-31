// Form routes answer two kinds of caller (brief 12.4): the enhanced form asks for JSON;
// a plain HTML form post (no JavaScript) gets a 303 redirect to a static page.

export function wantsJson(request: Request): boolean {
  return (request.headers.get('Accept') ?? '').includes('application/json');
}

export function respond(request: Request, status: number, body: Record<string, unknown>, page: string): Response {
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: status < 300, ...body }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(null, { status: 303, headers: { Location: page, 'Cache-Control': 'no-store' } });
}
