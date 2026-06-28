export function authorizeOutreachRequest(request: Request): Response | null {
  const expectedSecret = process.env.OUTREACH_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return null;

  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (provided !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
