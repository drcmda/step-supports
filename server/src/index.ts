/**
 * Cloudflare Worker entry point.
 *
 * Routes /api/* to API handlers, everything else to the static React build.
 */

import {
  type Env as ApiEnv,
  handleFreeTier,
  handleValidate,
  handleActivate,
  handleStripeWebhook,
  handleGetToken,
  handleCheckout,
  handleRecover,
} from "./api";
import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
// @ts-ignore — injected by wrangler [site] config
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

const assetManifest = JSON.parse(manifestJSON);

interface Env extends ApiEnv {
  __STATIC_CONTENT: KVNamespace;
}

function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    // API routes
    if (url.pathname.startsWith("/api/")) {
      switch (url.pathname) {
        case "/api/free-tier":
          return handleFreeTier(request, env);
        case "/api/validate":
          return handleValidate(request, env);
        case "/api/activate":
          return handleActivate(request, env);
        case "/api/webhook/stripe":
          return handleStripeWebhook(request, env);
        case "/api/token":
          return handleGetToken(url, env);
        case "/api/checkout":
          return handleCheckout(request, env);
        case "/api/recover":
          return handleRecover(request, env);
        default:
          return notFound();
      }
    }

    // Static assets from web/dist/ via KV
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        },
      );
    } catch {
      // SPA fallback: serve index.html for all non-API, non-asset routes
      try {
        const indexReq = new Request(new URL("/index.html", url.origin).toString(), request);
        return await getAssetFromKV(
          { request: indexReq, waitUntil: ctx.waitUntil.bind(ctx) },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          },
        );
      } catch {
        return notFound();
      }
    }
  },
};
