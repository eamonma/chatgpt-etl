import { describe, it, expect, vi } from "vitest";
import { MockClient } from "../helpers/mock-client.js";
import type { FetchRequest, FetchResponse } from "../../src/client/interface.js";

describe("MockClient", () => {
  const jsonResponse = (body: unknown, status = 200): FetchResponse => ({
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const get = (url: string): FetchRequest => ({ url, method: "GET", headers: {} });

  describe("basic routing", () => {
    it("matches a string pattern contained in the URL", async () => {
      const client = new MockClient({
        "/backend-api/conversations": {
          response: jsonResponse({ items: [{ id: "c1" }] }),
        },
      });

      const resp = await client.fetch(get("/backend-api/conversations?offset=0&limit=20"));

      expect(resp.status).toBe(200);
      expect(JSON.parse(resp.body)).toEqual({ items: [{ id: "c1" }] });
    });

    it("matches a RegExp pattern", async () => {
      const client = new MockClient({
        "/backend-api/conversation/": {
          response: jsonResponse({ id: "abc" }),
        },
      });

      const resp = await client.fetch(get("/backend-api/conversation/abc"));
      expect(resp.status).toBe(200);
      expect(JSON.parse(resp.body)).toEqual({ id: "abc" });
    });

    it("returns 404 for unmatched routes", async () => {
      const client = new MockClient({});
      const resp = await client.fetch(get("/unknown/path"));
      expect(resp.status).toBe(404);
    });

    it("uses the first matching route when multiple could match", async () => {
      const client = new MockClient([
        { pattern: "/backend-api/conversations", handler: { response: jsonResponse({ first: true }) } },
        { pattern: "/backend-api/", handler: { response: jsonResponse({ second: true }) } },
      ]);

      const resp = await client.fetch(get("/backend-api/conversations"));
      expect(JSON.parse(resp.body)).toEqual({ first: true });
    });
  });

  describe("call tracking", () => {
    it("counts calls per URL pattern", async () => {
      const client = new MockClient({
        "/backend-api/conversations": { response: jsonResponse({ items: [] }) },
      });

      await client.fetch(get("/backend-api/conversations?offset=0"));
      await client.fetch(get("/backend-api/conversations?offset=20"));

      expect(client.getCallCount("/backend-api/conversations")).toBe(2);
    });

    it("getCalls returns all calls when no filter is provided", async () => {
      const client = new MockClient({
        "/route-a": { response: jsonResponse({ a: true }) },
        "/route-b": { response: jsonResponse({ b: true }) },
      });

      await client.fetch(get("/route-a"));
      await client.fetch(get("/route-b"));

      expect(client.getCalls()).toHaveLength(2);
    });

    it("getCalls filters by string pattern", async () => {
      const client = new MockClient({
        "/route-a": { response: jsonResponse({ a: true }) },
        "/route-b": { response: jsonResponse({ b: true }) },
      });

      await client.fetch(get("/route-a"));
      await client.fetch(get("/route-b"));
      await client.fetch(get("/route-a"));

      const aCalls = client.getCalls("/route-a");
      expect(aCalls).toHaveLength(2);
      expect(aCalls.every((c) => c.request.url.includes("/route-a"))).toBe(true);
    });

    it("getCalls filters by RegExp", async () => {
      const client = new MockClient({
        "/items/": { response: jsonResponse({ item: true }) },
        "/users/": { response: jsonResponse({ user: true }) },
      });

      await client.fetch(get("/items/1"));
      await client.fetch(get("/items/2"));
      await client.fetch(get("/users/1"));

      expect(client.getCalls(/\/items\/\d+/)).toHaveLength(2);
    });

    it("reset clears recorded calls", async () => {
      const client = new MockClient({
        "/route": { response: jsonResponse({}) },
      });

      await client.fetch(get("/route"));
      expect(client.getCallCount()).toBe(1);

      client.reset();
      expect(client.getCallCount()).toBe(0);
    });

    it("records the exact request that was made", async () => {
      const client = new MockClient({
        "/api": { response: jsonResponse({}) },
      });

      const req: FetchRequest = { url: "/api?foo=bar", method: "POST", headers: { authorization: "Bearer tok" } };
      await client.fetch(req);

      const calls = client.getCalls("/api");
      expect(calls[0].request).toEqual(req);
    });
  });

  describe("dynamic response handler", () => {
    it("calls handler function with the request and returns its result", async () => {
      const handler = vi.fn((req: FetchRequest): FetchResponse => ({
        status: 200,
        headers: {},
        body: `echo:${req.url}`,
      }));

      const client = new MockClient({
        "/echo": { response: handler },
      });

      const resp = await client.fetch(get("/echo/hello"));
      expect(resp.body).toBe("echo:/echo/hello");
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("error injection", () => {
    it("throws the configured error for a route", async () => {
      const networkError = new Error("network error");
      const client = new MockClient({
        "/backend-api/fail": { error: networkError },
      });

      await expect(client.fetch(get("/backend-api/fail"))).rejects.toThrow("network error");
    });

    it("still records the call before throwing", async () => {
      const client = new MockClient({
        "/fail": { error: new Error("boom") },
      });

      await expect(client.fetch(get("/fail"))).rejects.toThrow();
      expect(client.getCallCount("/fail")).toBe(1);
    });
  });

  describe("configurable delay", () => {
    it("resolves after the configured delay", async () => {
      vi.useFakeTimers();

      const client = new MockClient({
        "/slow": { response: jsonResponse({ slow: true }), delayMs: 200 },
      });

      const promise = client.fetch(get("/slow"));
      await vi.advanceTimersByTimeAsync(200);
      const resp = await promise;

      expect(resp.status).toBe(200);

      vi.useRealTimers();
    });

    it("resolves promptly when no delay is configured", async () => {
      const client = new MockClient({
        "/fast": { response: jsonResponse({ fast: true }) },
      });

      const start = Date.now();
      await client.fetch(get("/fast"));
      expect(Date.now() - start).toBeLessThan(50);
    });
  });
});
