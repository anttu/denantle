// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = await realpath(new URL("../dist/", import.meta.url));
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    let file = resolve(root, `.${pathname}${pathname.endsWith("/") ? "index.html" : ""}`);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    file = await realpath(file);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": content.length,
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (error instanceof URIError) {
      response.writeHead(400).end();
    } else if (["ENOENT", "ENOTDIR", "EISDIR"].includes(String(code))) {
      response.writeHead(404).end();
    } else if (code === "EACCES") {
      response.writeHead(403).end();
    } else {
      console.error(error);
      response.writeHead(500).end();
    }
  }
});

server.on("error", (error) => {
  console.error(`Could not start the local server: ${error.message}`);
  process.exitCode = 1;
});

server.listen(8000, "127.0.0.1", () => {
  console.log("Denantle: http://localhost:8000 (Ctrl+C to stop)");
});
