import { describe, it, expect, afterEach } from "vitest";
import { WebSocketBridge } from "../../src/client/websocket-bridge.js";
import WebSocket from "ws";

describe("WebSocketBridge", () => {
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

  function connectClient(port: number): WebSocket {
    const client = new WebSocket(`ws://localhost:${port}`);
    clients.push(client);
    return client;
  }

  function waitForOpen(client: WebSocket): Promise<void> {
    return new Promise((resolve) => {
      if (client.readyState === WebSocket.OPEN) {
        resolve();
      } else {
        client.once("open", () => resolve());
      }
    });
  }

  it("starts a server on the specified port", async () => {
    bridge = new WebSocketBridge(54321);
    await bridge.start();

    // Verify port is in use by trying to bind to it
    const net = await import("net");
    const server = net.createServer();
    const bound = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(54321, () => {
        server.close();
        resolve(true);
      });
    });
    expect(bound).toBe(false); // Port should already be taken
  });

  it("waitForConnection() resolves when a WebSocket client connects", async () => {
    bridge = new WebSocketBridge(54322);
    await bridge.start();

    const connectionPromise = bridge.waitForConnection();

    const client = connectClient(54322);
    await connectionPromise;
    await waitForOpen(client);

    // If we get here, waitForConnection resolved
    expect(true).toBe(true);
  });

  it("fetch() sends request over WebSocket and receives matching response", async () => {
    bridge = new WebSocketBridge(54323);
    await bridge.start();

    const connectionPromise = bridge.waitForConnection();
    const client = connectClient(54323);
    await connectionPromise;
    await waitForOpen(client);

    // Set up the browser-side: echo back a response when we receive a request
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      client.send(
        JSON.stringify({
          id: msg.id,
          response: {
            status: 200,
            headers: { "content-type": "application/json" },
            body: '{"ok":true}',
          },
        })
      );
    });

    const response = await bridge.fetch({
      url: "https://chatgpt.com/api/conversations",
      method: "GET",
      headers: { authorization: "Bearer token" },
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(response.body).toBe('{"ok":true}');
  });

  it("concurrent fetch() calls are matched correctly by request ID", async () => {
    bridge = new WebSocketBridge(54324);
    await bridge.start();

    const connectionPromise = bridge.waitForConnection();
    const client = connectClient(54324);
    await connectionPromise;
    await waitForOpen(client);

    // Respond to requests in reverse order to prove ID matching works
    const received: { id: number; request: { url: string } }[] = [];
    client.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      received.push(msg);
      // Wait until we have both requests, then respond in reverse order
      if (received.length === 2) {
        for (const m of received.reverse()) {
          client.send(
            JSON.stringify({
              id: m.id,
              response: {
                status: 200,
                headers: {},
                body: m.request.url,
              },
            })
          );
        }
      }
    });

    const [r1, r2] = await Promise.all([
      bridge.fetch({ url: "/first", method: "GET", headers: {} }),
      bridge.fetch({ url: "/second", method: "GET", headers: {} }),
    ]);

    expect(r1.body).toBe("/first");
    expect(r2.body).toBe("/second");
  });

  it("fetch() rejects on timeout", async () => {
    bridge = new WebSocketBridge(54325, { timeoutMs: 50 });
    await bridge.start();

    const connectionPromise = bridge.waitForConnection();
    const client = connectClient(54325);
    await connectionPromise;
    await waitForOpen(client);

    // Don't respond — let it timeout
    await expect(
      bridge.fetch({ url: "/timeout", method: "GET", headers: {} })
    ).rejects.toThrowError(/timed out/i);
  });

  it("pending fetches reject on client disconnect", async () => {
    bridge = new WebSocketBridge(54326, { timeoutMs: 5000 });
    await bridge.start();

    const connectionPromise = bridge.waitForConnection();
    const client = connectClient(54326);
    await connectionPromise;
    await waitForOpen(client);

    // Start a fetch that won't get a response
    const fetchPromise = bridge.fetch({
      url: "/disconnect",
      method: "GET",
      headers: {},
    });

    // Disconnect the client
    client.close();

    await expect(fetchPromise).rejects.toThrowError(/disconnect/i);
  });

  it("handles malformed/non-JSON WebSocket messages without crashing", async () => {
    bridge = new WebSocketBridge(54327, { timeoutMs: 5000 });
    await bridge.start();

    const connectionPromise = bridge.waitForConnection();
    const client = connectClient(54327);
    await connectionPromise;
    await waitForOpen(client);

    // Send various malformed messages
    client.send("not json at all");
    client.send("{invalid json}}}");
    client.send(JSON.stringify({ noId: true }));
    client.send(JSON.stringify({ id: 999, response: null })); // unknown ID

    // Set up a proper echo handler for the next request
    client.on("message", (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.request) {
        client.send(
          JSON.stringify({
            id: msg.id,
            response: { status: 200, headers: {}, body: "ok" },
          })
        );
      }
    });

    // Bridge should still work after malformed messages
    const response = await bridge.fetch({
      url: "/still-works",
      method: "GET",
      headers: {},
    });
    expect(response.status).toBe(200);
    expect(response.body).toBe("ok");
  });

  it("close() releases the port so it can be re-bound immediately", async () => {
    const port = 54328;
    bridge = new WebSocketBridge(port);
    await bridge.start();
    await bridge.close();
    bridge = undefined;

    // Should be able to bind again immediately
    const bridge2 = new WebSocketBridge(port);
    await bridge2.start();
    await bridge2.close();
  });
});
