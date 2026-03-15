/**
 * Bridge + Script Integration Contract Test
 *
 * Validates the message format contract between WebSocketBridge and the
 * browser script (browser-script.ts). A local WebSocket client mimics
 * exactly what the injected browser script does:
 *   - receives: { id: number, request: { url, method, headers } }
 *   - sends back: { id: number, response: { status, headers, body } }
 */

import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { WebSocketBridge } from "../../src/client/websocket-bridge.js";
import type { FetchRequest, FetchResponse } from "../../src/client/interface.js";

const BASE_PORT = 54400;

describe("Bridge ↔ Browser Script message format contract", () => {
  let bridge: WebSocketBridge | undefined;
  const clients: WebSocket[] = [];

  afterEach(async () => {
    for (const c of clients) {
      if (c.readyState === WebSocket.OPEN) {
        c.close();
      }
    }
    clients.length = 0;
    if (bridge) {
      await bridge.close();
      bridge = undefined;
    }
  });

  /** Connect a browser-script-mimicking client to the bridge server. */
  function connectBrowserScriptClient(port: number): WebSocket {
    const ws = new WebSocket(`ws://localhost:${port}`);
    clients.push(ws);
    return ws;
  }

  function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      ws.once("open", resolve);
      ws.once("error", reject);
    });
  }

  /**
   * Wire up a WebSocket client so that it behaves exactly like the injected
   * browser script: parse `{ id, request }`, call (simulated) fetch, reply
   * with `{ id, response: { status, headers, body } }`.
   */
  function mimicBrowserScript(
    ws: WebSocket,
    cannedResponse: FetchResponse
  ): void {
    ws.on("message", (data) => {
      // Browser script: msg = JSON.parse(event.data)
      let msg: { id: number; request: FetchRequest };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return; // mirrors browser script's catch block
      }

      // Browser script: ws.send(JSON.stringify({ id, response: result }))
      const reply = JSON.stringify({ id: msg.id, response: cannedResponse });
      ws.send(reply);
    });
  }

  it("bridge sends outbound message with {id, request: {url, method, headers}}", async () => {
    bridge = new WebSocketBridge(BASE_PORT);
    await bridge.start();

    const connPromise = bridge.waitForConnection();
    const scriptClient = connectBrowserScriptClient(BASE_PORT);
    await connPromise;
    await waitForOpen(scriptClient);

    const capturedMessages: unknown[] = [];

    // Mimic browser script but also capture the raw inbound message
    scriptClient.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      capturedMessages.push(msg);

      // Send back a minimal valid response so bridge.fetch() resolves
      scriptClient.send(
        JSON.stringify({
          id: msg.id,
          response: { status: 200, headers: {}, body: "" },
        })
      );
    });

    const req: FetchRequest = {
      url: "https://chatgpt.com/backend-api/conversations",
      method: "GET",
      headers: { authorization: "Bearer tok", "content-type": "application/json" },
    };

    await bridge.fetch(req);

    expect(capturedMessages).toHaveLength(1);

    const outbound = capturedMessages[0] as { id: number; request: FetchRequest };

    // Validate the exact outbound message shape the browser script expects
    expect(typeof outbound.id).toBe("number");
    expect(outbound.id).toBeGreaterThan(0);
    expect(outbound.request).toBeDefined();
    expect(outbound.request.url).toBe(req.url);
    expect(outbound.request.method).toBe(req.method);
    expect(outbound.request.headers).toEqual(req.headers);

    // Must NOT contain extra top-level fields beyond id + request
    const keys = Object.keys(outbound);
    expect(keys).toContain("id");
    expect(keys).toContain("request");
    expect(keys).toHaveLength(2);
  });

  it("bridge resolves fetch() with canned FetchResponse from browser-script-like client", async () => {
    bridge = new WebSocketBridge(BASE_PORT + 1);
    await bridge.start();

    const connPromise = bridge.waitForConnection();
    const scriptClient = connectBrowserScriptClient(BASE_PORT + 1);
    await connPromise;
    await waitForOpen(scriptClient);

    const canned: FetchResponse = {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "abc123" },
      body: '{"items":[{"id":"conv1"}],"total":1}',
    };

    mimicBrowserScript(scriptClient, canned);

    const response = await bridge.fetch({
      url: "https://chatgpt.com/backend-api/conversations",
      method: "GET",
      headers: { authorization: "Bearer token" },
    });

    expect(response.status).toBe(canned.status);
    expect(response.headers).toEqual(canned.headers);
    expect(response.body).toBe(canned.body);
  });

  it("bridge assigns sequential IDs so concurrent requests are matched correctly", async () => {
    bridge = new WebSocketBridge(BASE_PORT + 2);
    await bridge.start();

    const connPromise = bridge.waitForConnection();
    const scriptClient = connectBrowserScriptClient(BASE_PORT + 2);
    await connPromise;
    await waitForOpen(scriptClient);

    // Mimic browser script: respond immediately using the received id
    scriptClient.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      // Echo the URL back as the body so we can assert ID routing
      scriptClient.send(
        JSON.stringify({
          id: msg.id,
          response: { status: 200, headers: {}, body: msg.request.url },
        })
      );
    });

    // Fire two requests simultaneously; bridge must route responses by ID
    const [r1, r2] = await Promise.all([
      bridge.fetch({ url: "/page/1", method: "GET", headers: {} }),
      bridge.fetch({ url: "/page/2", method: "GET", headers: {} }),
    ]);

    expect(r1.body).toBe("/page/1");
    expect(r2.body).toBe("/page/2");
  });

  it("browser-script error path: status 0 body is passed through as-is", async () => {
    bridge = new WebSocketBridge(BASE_PORT + 3);
    await bridge.start();

    const connPromise = bridge.waitForConnection();
    const scriptClient = connectBrowserScriptClient(BASE_PORT + 3);
    await connPromise;
    await waitForOpen(scriptClient);

    // Mimic the browser script's .catch() handler
    const errorResponse: FetchResponse = {
      status: 0,
      headers: {},
      body: "Fetch error: Failed to fetch",
    };

    mimicBrowserScript(scriptClient, errorResponse);

    const response = await bridge.fetch({
      url: "https://chatgpt.com/backend-api/conversations",
      method: "GET",
      headers: {},
    });

    // Bridge should surface the browser-script error payload unchanged
    expect(response.status).toBe(0);
    expect(response.headers).toEqual({});
    expect(response.body).toBe("Fetch error: Failed to fetch");
  });

  it("browser-script sends inbound message with {id, response: {status, headers, body}}", async () => {
    bridge = new WebSocketBridge(BASE_PORT + 4);
    await bridge.start();

    const connPromise = bridge.waitForConnection();
    const scriptClient = connectBrowserScriptClient(BASE_PORT + 4);
    await connPromise;
    await waitForOpen(scriptClient);

    // Capture exactly what the browser script would send back
    let sentPayload: unknown;

    scriptClient.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      // Compose response exactly as browser-script.ts does
      const responseResult: FetchResponse = {
        status: 201,
        headers: { "content-type": "text/plain" },
        body: "created",
      };
      const outbound = { id: msg.id, response: responseResult };
      sentPayload = outbound; // save before sending
      scriptClient.send(JSON.stringify(outbound));
    });

    await bridge.fetch({
      url: "https://chatgpt.com/backend-api/conversations",
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    // Validate the inbound message shape the bridge reads
    const inbound = sentPayload as { id: number; response: FetchResponse };
    expect(typeof inbound.id).toBe("number");
    expect(inbound.response).toBeDefined();
    expect(typeof inbound.response.status).toBe("number");
    expect(typeof inbound.response.headers).toBe("object");
    expect(typeof inbound.response.body).toBe("string");

    // Must NOT contain extra top-level fields beyond id + response
    const keys = Object.keys(inbound);
    expect(keys).toContain("id");
    expect(keys).toContain("response");
    expect(keys).toHaveLength(2);
  });
});
