---
name: setup
description: Use when user asks to get started, set up, export their ChatGPT data, or says "help me get started", "quickstart", "how do I use this". Guides them interactively through export and viewer setup.
---

# Setup

Walk the user through setup **interactively, one step at a time**. Confirm each step succeeds before moving on. If something fails, use the troubleshooting skill.

## Prereqs Check

Verify before starting:

1. **Node.js 22+** — run `node --version`
2. **Chrome browser** — logged into chatgpt.com
3. **CSP-disable extension** — required because ChatGPT's CSP blocks the WebSocket connection. Suggest "Disable Content-Security-Policy" extension. Must be enabled on chatgpt.com.

## Step 1: Install & Export

```bash
npm install
npx tsx bin/chatgpt-etl.ts --output ./output
```

Tell the user to paste the printed snippet into ChatGPT's DevTools console (F12 → Console). Export starts automatically.

Key points to mention:
- **Resumable**: Ctrl+C and re-run to continue
- `--limit N` to test with a small batch first
- `--dry-run` to see how many conversations exist
- `--delay-ms 1000` if they hit rate limits

## Step 2: Browse Locally

```bash
cd viewer && npm install
npm run server &
npm run dev
```

Open http://localhost:5173.

## Step 3: Sync Later

```bash
npx tsx bin/chatgpt-etl.ts --output ./output --refresh-list
```

Only downloads new/updated conversations.
