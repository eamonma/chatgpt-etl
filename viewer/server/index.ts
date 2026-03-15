import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

// Simple UUID-like pattern: hex chars and hyphens, 8-4-4-4-12 or similar
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Safe filename: no path separators, no "..", no null bytes
const SAFE_FILENAME_RE = /^[a-zA-Z0-9_\-][a-zA-Z0-9_\-. ]*$/;

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".json": "application/json",
  ".txt": "text/plain",
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || "";
}

/** Detect MIME type from file magic bytes when extension is missing. */
function detectMimeFromBytes(header: Buffer): string {
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return "image/png";
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "image/jpeg";
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) return "image/gif";
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return "image/webp";
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) return "application/pdf";
  return "application/octet-stream";
}

export interface ServerOptions {
  outputDir: string;
}

export function createServer(options: ServerOptions): http.Server {
  const { outputDir } = options;

  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    // GET /api/manifest
    if (pathname === "/api/manifest") {
      const manifestPath = path.join(outputDir, "manifest.json");
      fs.readFile(manifestPath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Manifest not found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
      return;
    }

    // GET /api/conversations-index — lightweight index with dates from all conversation files
    if (pathname === "/api/conversations-index") {
      const convDir = path.join(outputDir, "conversations");
      fs.readdir(convDir, (err, files) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to read conversations directory" }));
          return;
        }
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        const entries: { id: string; title: string; create_time: number; update_time: number }[] = [];
        let remaining = jsonFiles.length;
        if (remaining === 0) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify([]));
          return;
        }
        for (const file of jsonFiles) {
          fs.readFile(path.join(convDir, file), "utf8", (readErr, data) => {
            if (!readErr) {
              try {
                const conv = JSON.parse(data) as Record<string, unknown>;
                entries.push({
                  id: file.replace(".json", ""),
                  title: String(conv.title ?? ""),
                  create_time: Number(conv.create_time ?? 0),
                  update_time: Number(conv.update_time ?? 0),
                });
              } catch { /* skip malformed */ }
            }
            remaining--;
            if (remaining === 0) {
              entries.sort((a, b) => b.update_time - a.update_time);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(entries));
            }
          });
        }
      });
      return;
    }

    // GET /api/conversations/:id
    const convMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (convMatch) {
      const id = convMatch[1];
      if (!UUID_RE.test(id)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid conversation ID" }));
        return;
      }
      const filePath = path.join(outputDir, "conversations", `${id}.json`);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Conversation not found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
      return;
    }

    // GET /api/assets/:conversationId/:filename
    const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)\/([^/]+)$/);
    if (assetMatch) {
      const conversationId = assetMatch[1];
      const filename = assetMatch[2];

      if (!UUID_RE.test(conversationId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid conversation ID" }));
        return;
      }
      if (!SAFE_FILENAME_RE.test(filename) || filename.includes("..")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid filename" }));
        return;
      }

      const filePath = path.join(outputDir, "assets", conversationId, filename);
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Asset not found" }));
          return;
        }

        let mimeType = getMimeType(filename);
        if (!mimeType) {
          // No extension — detect from magic bytes
          const fd = fs.openSync(filePath, "r");
          const header = Buffer.alloc(8);
          fs.readSync(fd, header, 0, 8, 0);
          fs.closeSync(fd);
          mimeType = detectMimeFromBytes(header);
        }

        res.writeHead(200, {
          "Content-Type": mimeType,
          "Content-Length": stats.size,
        });
        fs.createReadStream(filePath).pipe(res);
      });
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return server;
}

// CLI entry point
if (process.argv[1] && (process.argv[1].endsWith("server/index.ts") || process.argv[1].endsWith("server/index.js"))) {
  const args = process.argv.slice(2);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  let outputDir = path.resolve(__dirname, "../../output");

  const outputIdx = args.indexOf("--output");
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputDir = path.resolve(args[outputIdx + 1]);
  }

  const port = parseInt(process.env.PORT || "3001", 10);
  const server = createServer({ outputDir });
  server.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
    console.log(`Serving data from ${outputDir}`);
  });
}
