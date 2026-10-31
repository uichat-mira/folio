import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

// 静态服务器模拟 GitHub Pages 的关键行为，供 FOL-008 浏览器证据使用：
// - 目录 URL 提供 index.html；
// - 无尾斜杠但对应目录时 301 到带尾斜杠的 URL；
// - 其余未知路径返回 404.html（不提供 SPA catch-all）。
const rootArg = process.argv[2];
const port = Number(process.argv[3] ?? 4178);
if (!rootArg) throw new Error("usage: node serve.mjs <root> [port]");
const root = resolve(rootArg);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function inside(path) {
  return path === root || path.startsWith(root + sep);
}

function resolveTarget(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = normalize(join(root, decoded));
  return inside(candidate) ? candidate : undefined;
}

function send(response, status, body, type) {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
}

const server = createServer((request, response) => {
  const urlPath = request.url ?? "/";
  const target = resolveTarget(urlPath);
  if (!target) return send(response, 403, "forbidden", "text/plain; charset=utf-8");

  if (urlPath.endsWith("/")) {
    const index = join(target, "index.html");
    if (existsSync(index)) {
      return send(response, 200, readFileSync(index), mime[".html"]);
    }
    const notFound = join(root, "404.html");
    return send(
      response,
      404,
      existsSync(notFound) ? readFileSync(notFound) : "not found",
      mime[".html"],
    );
  }

  if (existsSync(target) && statSync(target).isFile()) {
    return send(
      response,
      200,
      readFileSync(target),
      mime[extname(target)] ?? "application/octet-stream",
    );
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    response.writeHead(301, { location: urlPath + "/" });
    return response.end();
  }

  const notFound = join(root, "404.html");
  return send(
    response,
    404,
    existsSync(notFound) ? readFileSync(notFound) : "not found",
    mime[".html"],
  );
});

server.listen(port, "127.0.0.1", () => {
  console.log(`FOL-008 fixture server: http://127.0.0.1:${port}/ root=${root}`);
});
