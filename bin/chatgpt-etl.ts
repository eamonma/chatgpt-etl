import { WebSocketBridge } from "../src/client/websocket-bridge.js";
import { generateBrowserScript } from "../src/client/browser-script.js";

const PORT = 8787;

async function main(): Promise<void> {
  const bridge = new WebSocketBridge(PORT);

  console.log("Starting WebSocket bridge on port", PORT, "...");
  await bridge.start();
  console.log("Bridge listening on ws://localhost:" + PORT);

  const script = generateBrowserScript(PORT);

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
  console.log('  5. You should see: [chatgpt-etl] Connected to bridge on port', PORT);
  console.log("=".repeat(60));
  console.log("");

  console.log("Waiting for browser connection...");
  await bridge.waitForConnection();
  console.log("Browser connected.");

  console.log("");
  console.log("Sending test request: GET /backend-api/conversations?offset=0&limit=1&order=updated");

  const response = await bridge.fetch({
    url: "https://chatgpt.com/backend-api/conversations?offset=0&limit=1&order=updated",
    method: "GET",
    headers: {
      "oai-language": "en-US",
    },
  });

  console.log("");
  console.log("=".repeat(60));
  console.log("RESPONSE");
  console.log("-".repeat(60));
  console.log("Status:", response.status);
  console.log("Headers:", JSON.stringify(response.headers, null, 2));
  console.log("Body:", response.body);
  console.log("=".repeat(60));

  await bridge.close();
  console.log("");
  console.log("Bridge closed. Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
