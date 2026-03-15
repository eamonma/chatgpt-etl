/**
 * Test script to probe the file download API for different file ID formats.
 *
 * Usage:
 *   npx tsx bin/test-file-download.ts --port 8787
 *
 * Requires the browser bridge to be running (paste the script into ChatGPT console).
 */

import { WebSocketBridge } from "../src/client/websocket-bridge.js";
import { generateBrowserScript } from "../src/client/browser-script.js";

const FILE_IDS = [
  // Container-generated files ({{file:...}} pattern)
  "file-YQSnBm8FiUxwSAvSPVmWKZ",    // Find tire deals
  "file-FikXgasEMWDKwJ3hGYAWo3",    // Public reaction comparison
  "file-2XURzERNHjEt7rrfKecLYu",    // Data format argument
  "file-1GRJJw4U2YFB7FPjDwmVBf",    // Labubu vs Beanie Babies
  "file-LdvGMJbnuArP3b3vgUA28F",    // Labubu vs Beanie Babies (2nd file)
];

async function main() {
  const args = process.argv.slice(2);
  const portIdx = args.indexOf("--port");
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 8787;

  const bridge = new WebSocketBridge(port);
  console.log(`Starting bridge on port ${port}...`);
  await bridge.start();

  const script = generateBrowserScript(port, { compact: true });
  console.log("\nPaste this into ChatGPT's browser console:\n");
  console.log(script);
  console.log("\nWaiting for browser connection...");
  await bridge.waitForConnection();
  console.log("Connected!\n");

  // Get auth token
  const sessionResponse = await bridge.fetch({
    url: "https://chatgpt.com/api/auth/session",
    method: "GET",
    headers: {},
  });
  const session = JSON.parse(sessionResponse.body) as { accessToken?: string };
  if (!session.accessToken) {
    console.error("Failed to get access token");
    await bridge.close();
    process.exit(1);
  }
  const token = session.accessToken;
  console.log("Got auth token.\n");

  const headers = {
    Authorization: `Bearer ${token}`,
    "oai-language": "en-US",
  };

  // Test each file ID
  for (const fileId of FILE_IDS) {
    console.log(`=== Testing: ${fileId} ===`);

    // Try the standard download endpoint
    const downloadUrl = `https://chatgpt.com/backend-api/files/download/${fileId}?post_id=&inline=false`;
    console.log(`  GET ${downloadUrl}`);

    try {
      const resp = await bridge.fetch({
        url: downloadUrl,
        method: "GET",
        headers,
      });

      console.log(`  Status: ${resp.status}`);

      if (resp.status === 200) {
        try {
          const data = JSON.parse(resp.body);
          console.log(`  Response keys: ${Object.keys(data).join(", ")}`);
          console.log(`  download_url: ${data.download_url ? data.download_url.substring(0, 100) + "..." : "N/A"}`);
          console.log(`  file_name: ${data.file_name ?? "null"}`);
          console.log(`  status: ${data.status ?? "N/A"}`);
        } catch {
          console.log(`  Body (not JSON): ${resp.body.substring(0, 200)}`);
        }
      } else {
        console.log(`  Body: ${resp.body.substring(0, 300)}`);
      }
    } catch (err) {
      console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log();
  }

  // Also try the /backend-api/files/{fileId} endpoint (without /download)
  console.log("=== Also trying /backend-api/files/{fileId} (metadata endpoint) ===");
  const testId = FILE_IDS[0];
  try {
    const resp = await bridge.fetch({
      url: `https://chatgpt.com/backend-api/files/${testId}`,
      method: "GET",
      headers,
    });
    console.log(`  Status: ${resp.status}`);
    if (resp.status === 200) {
      try {
        const data = JSON.parse(resp.body);
        console.log(`  Response: ${JSON.stringify(data, null, 2).substring(0, 500)}`);
      } catch {
        console.log(`  Body: ${resp.body.substring(0, 300)}`);
      }
    } else {
      console.log(`  Body: ${resp.body.substring(0, 300)}`);
    }
  } catch (err) {
    console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  await bridge.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
