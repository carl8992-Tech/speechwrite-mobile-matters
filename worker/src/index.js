/**
 * Tiny CORS proxy for SpeechWrite auth/API/NLP hosts.
 * Only allowlisted hosts — do not open this to the whole internet without auth hardening.
 */
const ALLOW = new Set([
  "auth.tpro.io",
  "api.tpro.io",
  "rexapi.tpro.io",
  "rexapi.tpro-uk.com",
  "rexapi.tpro-au.com",
  "rexapi.tpro-sg.com",
]);

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(request) });
    }
    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) return new Response("Missing url", { status: 400, headers: cors(request) });
    let dest;
    try { dest = new URL(target); } catch {
      return new Response("Bad url", { status: 400, headers: cors(request) });
    }
    if (!ALLOW.has(dest.hostname)) {
      return new Response("Host not allowed", { status: 403, headers: cors(request) });
    }
    const headers = new Headers(request.headers);
    headers.delete("host");
    const upstream = await fetch(dest.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    });
    const out = new Response(upstream.body, upstream);
    const c = cors(request);
    c.forEach((v, k) => out.headers.set(k, v));
    return out;
  },
};

function cors(request) {
  const origin = request.headers.get("Origin") || "*";
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    Vary: "Origin",
  });
}
