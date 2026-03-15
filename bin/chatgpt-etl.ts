import { WebSocketBridge } from "../src/client/websocket-bridge.js";
import { generateBrowserScript } from "../src/client/browser-script.js";
import { runExport } from "../src/orchestrator.js";
import type { ExportManifest } from "../src/types.js";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  outputDir: string;
  port: number;
  includeArchived: boolean;
  includeProjects: boolean;
  includeAssets: boolean;
  limit?: number;
  dryRun: boolean;
  delayMs: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // drop 'node' and script path

  let outputDir: string | undefined;
  let port = 8787;
  let includeArchived = true;
  let includeProjects = true;
  let includeAssets = true;
  let limit: number | undefined;
  let dryRun = false;
  let delayMs = 500;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output" || arg === "-o") {
      outputDir = args[++i];
      if (!outputDir) {
        console.error("Error: --output requires a directory argument");
        process.exit(1);
      }
    } else if (arg === "--port" || arg === "-p") {
      const raw = args[++i];
      port = parseInt(raw, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Error: --port must be a valid port number (got: ${raw})`);
        process.exit(1);
      }
    } else if (arg === "--no-include-archived") {
      includeArchived = false;
    } else if (arg === "--include-archived") {
      includeArchived = true;
    } else if (arg === "--no-include-projects") {
      includeProjects = false;
    } else if (arg === "--include-projects") {
      includeProjects = true;
    } else if (arg === "--no-include-assets") {
      includeAssets = false;
    } else if (arg === "--include-assets") {
      includeAssets = true;
    } else if (arg === "--limit" || arg === "-l") {
      const raw = args[++i];
      limit = parseInt(raw, 10);
      if (isNaN(limit) || limit < 1) {
        console.error(`Error: --limit must be a positive integer (got: ${raw})`);
        process.exit(1);
      }
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--delay-ms") {
      const raw = args[++i];
      delayMs = parseInt(raw, 10);
      if (isNaN(delayMs) || delayMs < 0) {
        console.error(`Error: --delay-ms must be a non-negative integer (got: ${raw})`);
        process.exit(1);
      }
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Error: Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!outputDir) {
    console.error("Error: --output <dir> is required");
    printHelp();
    process.exit(1);
  }

  return { outputDir, port, includeArchived, includeProjects, includeAssets, limit, dryRun, delayMs };
}

function printHelp(): void {
  console.log(`
Usage: chatgpt-etl --output <dir> [options]

Options:
  --output, -o <dir>        Output directory for exported conversations (required)
  --port, -p <number>       WebSocket bridge port (default: 8787)
  --include-archived        Include archived conversations (default: true)
  --no-include-archived     Exclude archived conversations
  --include-projects        Include project conversations (default: true)
  --no-include-projects     Exclude project conversations
  --include-assets          Download assets/files (default: true)
  --no-include-assets       Skip asset downloads
  --limit, -l <number>      Only export first N conversations (for testing)
  --dry-run                 List conversations and save manifest, but don't download
  --delay-ms <number>       Milliseconds between API requests (default: 500)
  --help, -h                Show this help message
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let bridge: WebSocketBridge | null = null;
let currentManifest: ExportManifest | null = null;
let currentOutputDir: string | null = null;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  if (currentManifest && currentOutputDir) {
    const { saveManifest } = await import("../src/persistence/manifest.js");
    try {
      await saveManifest(currentOutputDir, currentManifest);
      console.log("Manifest saved.");
    } catch (err) {
      console.error("Warning: failed to save manifest during shutdown:", err);
    }
  }

  if (bridge) {
    try {
      await bridge.close();
      console.log("Bridge closed.");
    } catch {
      // ignore close errors during shutdown
    }
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  currentOutputDir = args.outputDir;

  // Start WebSocket bridge
  bridge = new WebSocketBridge(args.port);

  console.log(`Starting WebSocket bridge on port ${args.port}...`);
  await bridge.start();
  console.log(`Bridge listening on ws://localhost:${args.port}`);

  // Print browser script instructions
  const script = generateBrowserScript(args.port);

  console.log("");
  console.log("=".repeat(60));
  console.log("BROWSER SCRIPT — copy everything between the dashes");
  console.log("-".repeat(60));
  console.log(script);
  console.log("-".repeat(60));
  console.log("Instructions:");
  console.log("  1. Open https://chatgpt.com in your browser");
  console.log("  2. Open DevTools (F12 or Cmd+Option+I)");
  console.log("  3. Go to the Console tab");
  console.log("  4. Paste the script above and press Enter");
  console.log(`  5. You should see: [chatgpt-etl] Connected to bridge on port ${args.port}`);
  console.log("=".repeat(60));
  console.log("");

  // Wait for browser connection
  console.log("Waiting for browser connection...");
  await bridge.waitForConnection();
  console.log("Browser connected.");

  // Fetch auth token from browser session
  console.log("Fetching auth token from browser session...");
  const sessionResponse = await bridge.fetch({
    url: "https://chatgpt.com/api/auth/session",
    method: "GET",
    headers: {},
  });

  let token: string;
  try {
    const session = JSON.parse(sessionResponse.body) as { accessToken?: string };
    if (!session.accessToken) {
      throw new Error("accessToken not found in session response");
    }
    token = session.accessToken;
    console.log("Auth token obtained.");
  } catch (err) {
    console.error("Failed to obtain auth token:", err);
    console.error("Session response status:", sessionResponse.status);
    console.error("Session response body:", sessionResponse.body);
    await bridge.close();
    process.exit(1);
  }

  // Run export
  console.log("");
  console.log("=".repeat(60));
  console.log("EXPORT CONFIGURATION");
  console.log("-".repeat(60));
  console.log(`Output directory:  ${args.outputDir}`);
  console.log(`Include archived:  ${args.includeArchived}`);
  console.log(`Include projects:  ${args.includeProjects}`);
  console.log(`Include assets:    ${args.includeAssets}`);
  console.log(`Request delay:     ${args.delayMs}ms`);
  if (args.limit) console.log(`Limit:             ${args.limit} conversations`);
  if (args.dryRun) console.log(`Mode:              DRY RUN (no downloads)`);
  console.log("=".repeat(60));
  console.log("");

  const startTime = Date.now();

  console.log("Starting export...");

  const manifest = await runExport(bridge, token!, {
    outputDir: args.outputDir,
    includeArchived: args.includeArchived,
    includeProjects: args.includeProjects,
    includeAssets: args.includeAssets,
    maxConsecutiveErrors: 5,
    limit: args.limit,
    dryRun: args.dryRun,
    delayMs: args.delayMs,
    onProgress: (current: number, total: number, title: string) => {
      console.log(`[${current}/${total}] ${title}`);
    },
  });

  currentManifest = manifest;

  const elapsedMs = Date.now() - startTime;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  // Compute summary stats
  const conversations = Object.values(manifest.conversations);
  const totalCount = conversations.length;
  const completeCount = conversations.filter((c) => c.status === "complete").length;
  const errorCount = conversations.filter((c) => c.status === "error").length;
  const pendingCount = conversations.filter((c) => c.status === "pending").length;
  const totalAssets = conversations.reduce((sum, c) => sum + (c.assetCount ?? 0), 0);

  console.log("");
  console.log("=".repeat(60));
  console.log("EXPORT SUMMARY");
  console.log("-".repeat(60));
  console.log(`Total conversations: ${totalCount}`);
  console.log(`Exported (complete): ${completeCount}`);
  if (errorCount > 0) console.log(`Errors:              ${errorCount}`);
  if (pendingCount > 0) console.log(`Pending (skipped):   ${pendingCount}`);
  console.log(`Total assets:        ${totalAssets}`);
  console.log(`Time elapsed:        ${elapsedSec}s`);
  console.log(`Output directory:    ${args.outputDir}`);
  console.log("=".repeat(60));

  if (errorCount > 0) {
    console.log("\nConversations with errors:");
    for (const conv of conversations.filter((c) => c.status === "error")) {
      console.log(`  - [${conv.id}] ${conv.title}: ${conv.error}`);
    }
  }

  await bridge.close();
  console.log("\nBridge closed. Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
