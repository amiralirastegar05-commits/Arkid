const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.includes(origin)) return null;

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

async function verifySupabaseUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401 };

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, status: 503, reason: "auth_not_configured" };
  }

  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  let response;
  try {
    response = await fetch(`${baseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${match[1]}`,
    },
    });
  } catch (_) {
    return { ok: false, status: 503, reason: "auth_unavailable" };
  }

  if (response.status >= 500 || response.status === 429) return { ok: false, status: 503, reason: "auth_unavailable" };
  if (!response.ok) return { ok: false, status: 401 };

  const user = await response.json();
  if (!user || typeof user.id !== "string") {
    return { ok: false, status: 401 };
  }

  return { ok: true, user };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Health is deliberately public and carries no credentials or private data.
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "arkid-api", version: 1 }, 200, { "access-control-allow-origin": "*" });
    }
    const cors = corsHeaders(request, env);
    const origin = request.headers.get("Origin");

    if (origin && !cors) {
      return json({ error: "origin_not_allowed" }, 403, { "vary": "Origin" });
    }

    if (request.method === "OPTIONS") {
      if (!cors) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }

    const headers = cors || { "vary": "Origin" };

    if (request.method === "GET" && url.pathname === "/v1/me") {
      const result = await verifySupabaseUser(request, env);
      if (!result.ok) {
        return json(
          { error: result.reason || "unauthorized" },
          result.status,
          headers
        );
      }

      return json(
        {
          id: result.user.id,
          email: result.user.email ?? null,
          email_confirmed_at: result.user.email_confirmed_at ?? null,
          created_at: result.user.created_at ?? null,
        },
        200,
        headers
      );
    }

    return json({ error: "not_found" }, 404, headers);
  },
};
