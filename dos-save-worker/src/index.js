import { importX509, jwtVerify } from "jose";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

/** @type {{ certs: Record<string, string> | null, expires: number }} */
const certCache = { certs: null, expires: 0 };

async function getGoogleCerts() {
  if (certCache.certs && Date.now() < certCache.expires) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error("Failed to fetch Google certs");
  certCache.certs = await res.json();
  const maxAge = res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1];
  certCache.expires = Date.now() + (maxAge ? Number(maxAge) * 1000 : 3_600_000);
  return certCache.certs;
}

/**
 * 驗證 Firebase ID Token，回傳 uid（JWT sub）
 * @param {string} token
 * @param {string} projectId
 */
async function verifyFirebaseToken(token, projectId) {
  const headerB64 = token.split(".")[0];
  const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
  const certs = await getGoogleCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error("Unknown kid");

  const key = await importX509(pem, "RS256");
  const { payload } = await jwtVerify(token, key, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  if (!payload.sub) throw new Error("Missing sub");
  return payload.sub;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/health" && request.method === "GET") {
      return json({ ok: true });
    }

    if (path !== "/save") {
      return json({ error: "Not found" }, 404);
    }

    let uid;
    try {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      uid = await verifyFirebaseToken(auth.slice(7), env.FIREBASE_PROJECT_ID);
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    const key = `saves/${uid}.changes`;

    if (request.method === "GET") {
      const obj = await env.SAVES.get(key);
      if (!obj) return withCors(new Response(null, { status: 404 }));
      return withCors(
        new Response(obj.body, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    }

    if (request.method === "PUT") {
      const body = await request.arrayBuffer();
      if (!body.byteLength) return json({ error: "Empty body" }, 400);
      await env.SAVES.put(key, body);
      return json({ ok: true });
    }

    if (request.method === "DELETE") {
      await env.SAVES.delete(key);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
