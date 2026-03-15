import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createServer } from "../../server/index.js";

let server: http.Server;
let baseUrl: string;
let tmpDir: string;

const FAKE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function fetch(urlPath: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${urlPath}`, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode!,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

beforeAll(async () => {
  // Create temp fixture directory
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));

  // Create fixture data
  const manifestData = { version: 1, conversations: { [FAKE_ID]: { id: FAKE_ID, title: "Test" } } };
  fs.writeFileSync(path.join(tmpDir, "manifest.json"), JSON.stringify(manifestData));

  fs.mkdirSync(path.join(tmpDir, "conversations"), { recursive: true });
  const conversationData = { id: FAKE_ID, title: "Test", messages: [{ role: "user", content: "hello" }] };
  fs.writeFileSync(path.join(tmpDir, "conversations", `${FAKE_ID}.json`), JSON.stringify(conversationData));

  fs.mkdirSync(path.join(tmpDir, "assets", FAKE_ID), { recursive: true });
  // Write a small PNG-like binary file
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  fs.writeFileSync(path.join(tmpDir, "assets", FAKE_ID, "image.png"), pngHeader);

  server = createServer({ outputDir: tmpDir });
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("API Server", () => {
  describe("GET /api/manifest", () => {
    it("returns manifest JSON with 200", async () => {
      const res = await fetch("/api/manifest");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const data = JSON.parse(res.body.toString());
      expect(data.version).toBe(1);
      expect(data.conversations[FAKE_ID].title).toBe("Test");
    });

    it("includes CORS headers", async () => {
      const res = await fetch("/api/manifest");
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });
  });

  describe("GET /api/conversations/:id", () => {
    it("returns conversation JSON with 200", async () => {
      const res = await fetch(`/api/conversations/${FAKE_ID}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const data = JSON.parse(res.body.toString());
      expect(data.id).toBe(FAKE_ID);
      expect(data.messages).toHaveLength(1);
    });

    it("returns 404 for missing conversation", async () => {
      const missingId = "00000000-0000-0000-0000-000000000000";
      const res = await fetch(`/api/conversations/${missingId}`);
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid ID (not UUID-like)", async () => {
      const res = await fetch("/api/conversations/not-a-valid-uuid");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/assets/:conversationId/:filename", () => {
    it("serves binary asset file with correct content-type", async () => {
      const res = await fetch(`/api/assets/${FAKE_ID}/image.png`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/png");
      // Check PNG magic bytes
      expect(res.body[0]).toBe(0x89);
      expect(res.body[1]).toBe(0x50);
    });

    it("returns 404 for missing asset", async () => {
      const res = await fetch(`/api/assets/${FAKE_ID}/nonexistent.png`);
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid conversationId in assets", async () => {
      const res = await fetch("/api/assets/not-a-uuid/image.png");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid filename in assets", async () => {
      // Filename starting with dot should be rejected
      const res = await fetch(`/api/assets/${FAKE_ID}/.hidden`);
      expect(res.status).toBe(400);
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unknown paths", async () => {
      const res = await fetch("/api/unknown");
      expect(res.status).toBe(404);
    });
  });
});
