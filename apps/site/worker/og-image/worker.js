const WECHAT_UA = /MicroMessenger|WeChat/i;
const WECHAT_REFERER = /servicewechat\.com/i;

/**
 * WeChat's in-app browser and its link crawler both identify themselves with
 * MicroMessenger. The referer check covers image fetches proxied by WeChat.
 */
export function isWeChatRequest(userAgent = "", referer = "") {
  return WECHAT_UA.test(userAgent) || WECHAT_REFERER.test(referer);
}

export function selectImagePath(userAgent = "", referer = "", env = {}) {
  return isWeChatRequest(userAgent, referer)
    ? env.WECHAT_IMAGE || "/folio/icon-512.png"
    : env.DEFAULT_IMAGE || "/folio/folio-og-1200x630.png";
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname !== "/og") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const userAgent = request.headers.get("user-agent") || "";
    const referer = request.headers.get("referer") || "";
    const wechat = isWeChatRequest(userAgent, referer);
    const imagePath = selectImagePath(userAgent, referer, env);
    const origin = env.ORIGIN || "https://uichat-mira.github.io";
    const imageUrl = new URL(imagePath, origin).toString();

    let upstream;
    try {
      upstream = await fetch(imageUrl, {
        cf: { cacheEverything: true, cacheTtl: 300 },
      });
    } catch {
      return new Response("Image unavailable", { status: 502 });
    }
    if (!upstream.ok) {
      return new Response("Image unavailable", { status: 502 });
    }

    const headers = new Headers(upstream.headers);
    // The URL is shared by every crawler; never let a shared cache pin one
    // variant for all user agents.
    headers.set("cache-control", "no-store");
    headers.set("vary", "User-Agent, Referer");
    headers.set("x-folio-og-variant", wechat ? "wechat" : "default");
    headers.set("access-control-allow-origin", "*");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers,
    });
  },
};
