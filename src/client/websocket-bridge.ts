import { WebSocketServer, type WebSocket } from "ws";
import type { ChatGptClient, FetchRequest, FetchResponse } from "./interface.js";

export interface WebSocketBridgeOptions {
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (res: FetchResponse) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class WebSocketBridge implements ChatGptClient {
  private wss: WebSocketServer | undefined;
  private client: WebSocket | undefined;
  private port: number;
  private timeoutMs: number;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();

  constructor(port: number, options?: WebSocketBridgeOptions) {
    this.port = port;
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });
      this.wss.once("listening", () => resolve());
      this.wss.once("error", (err) => reject(err));
    });
  }

  waitForConnection(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        resolve();
        return;
      }
      this.wss!.once("connection", (ws) => {
        this.client = ws;
        this.setupClientHandlers(ws);
        resolve();
      });
    });
  }

  private setupClientHandlers(ws: WebSocket): void {
    ws.on("message", (data) => {
      let msg: { id: number; response: FetchResponse };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        // Ignore malformed messages
        return;
      }

      const pending = this.pending.get(msg.id);
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        pending.resolve(msg.response);
      }
    });

    ws.on("close", () => {
      this.client = undefined;
      for (const [id, pending] of this.pending) {
        if (pending.timer) clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.reject(new Error("WebSocket client disconnected"));
      }
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async fetch(req: FetchRequest): Promise<FetchResponse> {
    if (!this.client) {
      throw new Error("No WebSocket client connected");
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Fetch request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.client!.send(JSON.stringify({ id, request: req }));
    });
  }
}
