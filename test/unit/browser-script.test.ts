import { describe, it, expect } from "vitest";
import { generateBrowserScript } from "../../src/client/browser-script.js";

describe("generateBrowserScript", () => {
  it("generates syntactically valid JavaScript", () => {
    const script = generateBrowserScript(8080);
    // new Function() will throw a SyntaxError if the script is invalid JS
    expect(() => new Function(script)).not.toThrow();
  });

  it("contains the correct WebSocket URL for the given port", () => {
    const script = generateBrowserScript(9876);
    expect(script).toContain("ws://localhost:9876");
  });

  it("uses a different port when a different port is provided", () => {
    const script = generateBrowserScript(3333);
    expect(script).toContain("ws://localhost:3333");
    expect(script).not.toContain("ws://localhost:9876");
  });

  it("contains no Node.js constructs — browser-only JS", () => {
    const script = generateBrowserScript(8080);
    // Must not contain import/require/process (Node-isms)
    expect(script).not.toMatch(/\bimport\b/);
    expect(script).not.toMatch(/\brequire\s*\(/);
    expect(script).not.toMatch(/\bprocess\./);
    expect(script).not.toMatch(/\bmodule\.exports\b/);
    expect(script).not.toMatch(/\bexports\./);
  });

  it("uses fetch with credentials: 'include'", () => {
    const script = generateBrowserScript(8080);
    expect(script).toContain('credentials');
    expect(script).toContain('include');
  });

  it("sends back response with id, status, headers, body", () => {
    const script = generateBrowserScript(8080);
    expect(script).toContain("id");
    expect(script).toContain("status");
    expect(script).toContain("headers");
    expect(script).toContain("body");
  });

  it("compact mode produces a single line", () => {
    const script = generateBrowserScript(8080, { compact: true });
    const lines = script.split("\n");
    expect(lines).toHaveLength(1);
  });

  it("compact mode produces syntactically valid JavaScript", () => {
    const script = generateBrowserScript(8080, { compact: true });
    expect(() => new Function(script)).not.toThrow();
  });

  it("compact mode preserves correct WebSocket URL", () => {
    const script = generateBrowserScript(4444, { compact: true });
    expect(script).toContain("ws://localhost:4444");
  });

  it("uses arrayBuffer and btoa for base64 encoding of response body", () => {
    const script = generateBrowserScript(8080);
    expect(script).toContain("arrayBuffer");
    expect(script).toContain("btoa");
  });
});
