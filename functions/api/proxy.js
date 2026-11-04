/**
 * CORS-safe proxy for T-Pro / SpeechWrite APIs.
 * Browser calls same-origin /api/proxy with JSON { url, method, headers, body }.
 */
const ALLOWED_HOSTS = new Set([
  "auth.tpro.io",
  "api.tpro.io",
  "api.tpro-uk.com",
  "api.tpro-au.com",
  "api.tpro-sg.com",
  "rexapi.tpro.io",
  "rexapi.tpro-uk.com",
  "rexapi.tpro-au.com",
  "rexapi.tpro-sg.com",
]);

export async function onRequest(context) {
  const request = context.request;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json({ error: "POST only" }, 405, request);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400, request);
  }

  let target;
  try {
    target = new URL(String(payload.url || ""));
  } catch (_) {
    return json({ error: "Bad url" }, 400, request);
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return json({ error: "Host not allowed" }, 403, request);
  }

  const method = String(payload.method || "GET").toUpperCase();
  const headers = new Headers();
  const incoming = payload.headers && typeof payload.headers === "object" ? payload.headers : {};
  for (const [key, value] of Object.entries(incoming)) {
    if (/^(host|origin|referer|content-length)$/i.test(key)) continue;
    if (value == null) continue;
    headers.set(key, String(value));
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD" && payload.body != null) {
    init.body = typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  try {
    const upstream = await fetch(target.toString(), init);
    const text = await upstream.text();
    const outHeaders = corsHeaders(request);
    outHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
    return new Response(text, { status: upstream.status, headers: outHeaders });
  } catch (error) {
    return json({ error: String(error && error.message ? error.message : error) }, 502, request);
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
}

function json(body, status, request) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(Object.fromEntries(corsHeaders(request)), {
      "Content-Type": "application/json",
    }),
  });
}
