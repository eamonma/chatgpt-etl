import type {
  ChatGptClient,
  FetchRequest,
  FetchResponse,
} from "../../src/client/interface.js";

export type RouteHandler =
  | { response: FetchResponse | ((req: FetchRequest) => FetchResponse); delayMs?: number }
  | { error: Error; delayMs?: number };

export type RouteMap = Record<string, RouteHandler>;

export interface RecordedCall {
  request: FetchRequest;
  timestamp: number;
}

export class MockClient implements ChatGptClient {
  private readonly routes: Array<{ pattern: string | RegExp; handler: RouteHandler }>;
  private readonly calls: RecordedCall[] = [];

  constructor(routes: Record<string, RouteHandler> | Array<{ pattern: string | RegExp; handler: RouteHandler }>) {
    if (Array.isArray(routes)) {
      this.routes = routes;
    } else {
      this.routes = Object.entries(routes).map(([pattern, handler]) => ({
        pattern,
        handler,
      }));
    }
  }

  async fetch(req: FetchRequest): Promise<FetchResponse> {
    this.calls.push({ request: req, timestamp: Date.now() });

    const match = this.findRoute(req.url);

    if (!match) {
      return {
        status: 404,
        headers: {},
        body: JSON.stringify({ error: `No route matched: ${req.url}` }),
      };
    }

    const { handler } = match;

    if (handler.delayMs != null && handler.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, handler.delayMs));
    }

    if ("error" in handler) {
      throw handler.error;
    }

    const { response } = handler;
    if (typeof response === "function") {
      return response(req);
    }
    return response;
  }

  private findRoute(url: string): { pattern: string | RegExp; handler: RouteHandler } | undefined {
    for (const route of this.routes) {
      if (typeof route.pattern === "string") {
        if (url.includes(route.pattern)) {
          return route;
        }
      } else {
        if (route.pattern.test(url)) {
          return route;
        }
      }
    }
    return undefined;
  }

  /** Return all recorded calls, optionally filtered by URL pattern. */
  getCalls(urlPattern?: string | RegExp): RecordedCall[] {
    if (urlPattern == null) {
      return [...this.calls];
    }
    return this.calls.filter(({ request }) => {
      if (typeof urlPattern === "string") {
        return request.url.includes(urlPattern);
      }
      return urlPattern.test(request.url);
    });
  }

  /** Return the number of times a URL (or matching pattern) was called. */
  getCallCount(urlPattern?: string | RegExp): number {
    return this.getCalls(urlPattern).length;
  }

  /** Reset recorded calls. */
  reset(): void {
    this.calls.length = 0;
  }
}
