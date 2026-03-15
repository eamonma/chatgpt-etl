---
name: troubleshooting
description: Use when user reports an error, something not working, export failing, viewer not loading, images missing, WebSocket issues, connection problems, timeouts, or asks "why isn't this working". Diagnose and fix common chatgpt-etl issues.
---

# Troubleshooting

Diagnose the user's issue by checking the tables below. Ask clarifying questions if the symptom isn't clear. Run diagnostic commands (check manifest status, test endpoints, inspect files) to confirm before prescribing a fix.

## Connection & Auth

| Symptom | Cause | Fix |
|---------|-------|-----|
| `WebSocket connection failed` or snippet silently does nothing | ChatGPT's CSP blocks `ws://localhost` | Install and **enable** a CSP-disable extension on chatgpt.com, refresh, re-paste |
| `[chatgpt-etl] Failed to get access token` in browser console | Not logged in, or session cookie expired | Log into chatgpt.com, refresh, re-paste |
| `accessToken not found in session response` in CLI | Session endpoint returned empty | Log in again in the browser |
| CLI says "Waiting for browser connection..." forever | Snippet not pasted, or CSP blocked silently | Check browser console — if no `[chatgpt-etl]` logs, CSP is blocking |
| `EADDRINUSE` / port 8787 in use | Another process on that port | Use `--port 9999` (or any free port) |

## During Export

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Fetch request timed out after 30000ms` | Browser tab sleeping or closed | Keep ChatGPT tab active and visible. Re-run to resume |
| `Export aborted: 5 consecutive errors` | Rate limit or network failures | Wait a minute, re-run. Use `--delay-ms 1000` to slow down |
| Conversations with status `"error"` in manifest | Individual fetch failed (deleted, permissions) | Re-run — it retries errors. Persistent errors may be deleted conversations |
| Export very slow | Large conversations with many assets | Normal. Check terminal for progress output |
| `WebSocket client disconnected` | Browser tab closed or navigated away | Re-paste snippet in ChatGPT tab. Re-run CLI to resume |

## Viewer

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty conversation list | Server not running or wrong output dir | Ensure `npm run server` is running. Default data dir is `../output` |
| Images not showing | Assets not downloaded, or missing from `_index.json` | Re-run export with `--include-assets`. Check `output/assets/<conv-id>/` |
| `ECONNREFUSED` on localhost:3001 | API server not started | Run `npm run server` before `npm run dev` |
| Viewer port 5173 in use | Another Vite dev server | Kill it, or Vite auto-picks next port (5174, etc.) |

## Recovery

The export is fully resumable via `output/manifest.json` which tracks `"complete"`, `"pending"`, and `"error"` status per conversation. Re-running the same command skips completed ones.

**Force re-export**: edit `manifest.json`, set specific conversations' status to `"pending"`, re-run.

**Fetch new conversations**: use `--refresh-list` to incrementally sync.

## Diagnostic Commands

When debugging, check these:

```bash
# How many conversations in each state?
node -e 'const m=JSON.parse(require("fs").readFileSync("output/manifest.json","utf8"));const c=Object.values(m.conversations);console.log("complete:",c.filter(x=>x.status==="complete").length,"error:",c.filter(x=>x.status==="error").length,"pending:",c.filter(x=>x.status==="pending").length)'

# List errored conversations
node -e 'const m=JSON.parse(require("fs").readFileSync("output/manifest.json","utf8"));Object.values(m.conversations).filter(x=>x.status==="error").forEach(x=>console.log(x.id,x.error))'

# Check if a conversation's assets exist
ls output/assets/<conversation-id>/

# Test viewer API
curl -s http://localhost:3001/api/manifest | head -c 200
```
