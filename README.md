# chatgpt-etl

Export all ChatGPT conversations from a Business/Teams plan that lacks built-in export, and browse them locally.

A Node.js CLI proxies API requests through a browser script pasted into ChatGPT's console, bypassing Cloudflare. Produces a resumable JSON archive. A local viewer app renders conversations with full markdown, code highlighting, citations, and images.

## Prerequisites

- Node.js 22+
- A Chrome extension to disable CSP on chatgpt.com (e.g. "Disable Content-Security-Policy")

## Quick start

```bash
# 1. Install and export all conversations
npm install
npx tsx bin/chatgpt-etl.ts --output ./output
```

The CLI prints a one-line script — paste it into ChatGPT's browser DevTools console (F12 → Console). The export starts automatically and downloads all conversations, images, and files. It's resumable: Ctrl+C and re-run the same command to pick up where you left off.

```bash
# 2. Browse your conversations locally
cd viewer
npm install
npm run server &    # serves data from ../output
npm run dev         # starts the viewer at http://localhost:5173
```

## Usage

```bash
npx tsx bin/chatgpt-etl.ts --output <dir> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--output, -o <dir>` | required | Output directory |
| `--limit, -l <n>` | all | Export next N pending conversations |
| `--dry-run` | off | List conversations and save manifest, but don't download |
| `--delay-ms <n>` | 500 | Milliseconds between API requests |
| `--refresh-list` | off | Incrementally sync: fetches only new/updated conversations |
| `--port, -p <n>` | 8787 | WebSocket bridge port |
| `--no-include-archived` | included | Skip archived conversations |
| `--no-include-projects` | included | Skip project conversations |
| `--no-include-assets` | included | Skip file/image downloads |

## Kitchen sink example

```bash
# Full export: all conversations, all assets, 1s pacing
npx tsx bin/chatgpt-etl.ts \
  --output ./chatgpt-backup \
  --delay-ms 1000 \
  --include-archived \
  --include-projects \
  --include-assets

# Dry run first to see what's there (lists all conversations, saves manifest)
npx tsx bin/chatgpt-etl.ts --output ./chatgpt-backup --dry-run

# Export in batches of 10 (re-run to get the next 10)
npx tsx bin/chatgpt-etl.ts --output ./chatgpt-backup --limit 10

# Test with 5 conversations, no assets, fast
npx tsx bin/chatgpt-etl.ts --output ./test-export --limit 5 --no-include-assets --delay-ms 200

# Resume after interruption (just re-run the same command)
npx tsx bin/chatgpt-etl.ts --output ./chatgpt-backup

# Sync new/updated conversations since last export (incremental)
npx tsx bin/chatgpt-etl.ts --output ./chatgpt-backup --refresh-list

# Different port if 8787 is taken
npx tsx bin/chatgpt-etl.ts --output ./output --port 9999
```

## Output

```
output/
  manifest.json              # tracks export progress (enables resume)
  conversations/
    {id}.json                # raw API response per conversation
  assets/
    {conversation-id}/
      {filename}             # downloaded images/files
      _index.json            # fileId → fileName mapping
```

## Incremental sync

`--refresh-list` compares the API's conversation list against saved files on disk by `update_time`. Only new and updated conversations are re-fetched. Pagination stops early once a full page of unchanged conversations is found, so syncing a few new chats against a large archive is fast.

## How it works

1. CLI starts a WebSocket server on localhost
2. You paste a one-line script into ChatGPT's browser console
3. The script connects back and acts as a fetch proxy, using the browser's authenticated session
4. CLI sends API requests through the proxy, saves responses to disk
5. Manifest tracks progress; Ctrl+C and re-run to resume

## Viewer

The viewer is a local web app in `viewer/` (see Quick start above). To point at a different export directory:

```bash
cd viewer
npm run server -- --output /path/to/export &
npm run dev
```

## Development

```bash
npm test          # run tests (vitest)
npm run typecheck  # type check (tsc --noEmit)
```
