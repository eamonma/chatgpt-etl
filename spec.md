# ChatGPT Export JSON Format Specification

Exhaustive spec derived from scanning all 656 exported conversation files (of ~1,171 total). See §1.8 for completeness caveats.

---

## 1.1 Conversation File

Each file is `output/conversations/{conversation_id}.json`. Every file contains exactly these 30 top-level keys (all present in 656/656 files):

```typescript
interface ConversationFile {
  title: string;
  create_time: number;                          // Unix timestamp (seconds, float)
  update_time: number;                          // Unix timestamp (seconds, float)
  mapping: Record<string, MappingNode>;         // Message tree (DAG)
  moderation_results: unknown[];                // Always empty array in practice
  current_node: string;                         // UUID of the active leaf node

  // Identity
  conversation_id: string;                      // UUID (matches filename)
  conversation_template_id: string | null;
  gizmo_id: string | null;                      // Custom GPT ID if applicable
  gizmo_type: string | null;

  // State flags
  is_archived: boolean;
  is_starred: boolean | null;
  is_read_only: boolean | null;
  is_do_not_remember: boolean;
  is_study_mode: boolean;
  atlas_mode_enabled: boolean | null;

  // URLs
  safe_urls: string[];
  blocked_urls: string[];

  // Model & config
  default_model_slug: string;                   // e.g. "gpt-5-2-thinking"
  plugin_ids: string[] | null;
  disabled_tool_ids: string[];
  conversation_origin: string | null;

  // Audio/voice
  voice: string | null;
  async_status: string | null;

  // Memory
  memory_scope: string;                         // e.g. "global_enabled"
  context_scopes: unknown | null;

  // Sugar (UI features)
  sugar_item_id: string | null;
  sugar_item_visible: boolean;
  pinned_time: number | null;

  // Ownership
  owner: string | null;
}
```

## 1.2 Mapping Node (Message Tree)

The `mapping` is a directed acyclic graph. Each node has exactly 4 keys:

```typescript
interface MappingNode {
  id: string;                   // UUID or "client-created-root"
  message: MessageObject | null; // null only for the root node
  parent: string | null;        // null only for the root node
  children: string[];           // UUIDs of child nodes (empty for leaf)
}
```

**Tree structure:**
- Root node: `id: "client-created-root"`, `message: null`, `parent: null`
- Linear conversations: each node has exactly 1 child
- **Branches** occur when a user edits/regenerates: a parent has multiple children. `current_node` traces back through the "active" branch.
- To reconstruct the active thread: walk from `current_node` up via `parent` pointers to root.

## 1.3 Message Object

Every non-null message has exactly 11 keys:

```typescript
interface MessageObject {
  id: string;                                   // UUID (matches MappingNode.id)
  author: {
    role: "user" | "assistant" | "system" | "tool";
    name?: string | null;                       // Tool/agent name (see §1.3.1)
    metadata?: Record<string, unknown>;         // Usually empty {}
  };
  create_time: number | null;                   // Unix timestamp or null
  update_time: number | null;                   // Unix timestamp or null
  content: MessageContent;                      // See §1.4
  status: "finished_successfully" | "in_progress";
  end_turn: boolean | null;                     // true = end of assistant turn
  weight: 0 | 1;                                // 0 = hidden/non-selected, 1 = active
  metadata: Record<string, unknown>;            // See §1.5
  recipient: string;                            // See §1.3.2
  channel: null | "final" | "commentary";
}
```

### 1.3.1 Author Names (23 unique values)

Tool invocations set `author.name`. Most common:

| Name | Count | Purpose |
|------|-------|---------|
| `web.run` | 3,931 | Web search execution |
| `python` | 207 | Code interpreter |
| `mtbrowser.search` | 91 | Multi-tab browser search |
| `browser.open` | 90 | Browser page open |
| `t2uay3k.sj1i4kz` | 84 | Custom GPT tool |
| `file_search` | 65 | File search tool |
| `container.open_image` | 25 | Image from container |
| `browser.find` | 23 | Browser find |
| `browser.search` | 22 | Browser search |
| `container.exec` | 21 | Container execution |
| `a8km123` | 20 | Custom GPT tool |
| `api_tool.call_tool` | 17 | API tool call |
| `computer.do` | 17 | Computer use |
| `api_tool.list_resources` | 12 | API resource listing |
| `api_tool` | 6 | API tool |
| `computer.get` | 4 | Computer use |
| `computer.sync_file` | 3 | Computer file sync |
| `container.download` | 2 | Container download |
| `n7jupd.metadata` | 2 | Tasks metadata |
| `research_kickoff_tool.*` | 2 | Deep research |
| `computer.initialize` | 1 | Computer use |
| `imagegen` | 1 | Image generation |

### 1.3.2 Recipient Values (21 unique)

| Recipient | Count | Meaning |
|-----------|-------|---------|
| `all` | 15,701 | Normal message (visible to user) |
| `web.run` | 2,365 | Directed to web search tool |
| `python` | 224 | Directed to code interpreter |
| `assistant` | 105 | Tool result back to assistant |
| `browser.open` | 90 | Directed to browser |
| `web` | 81 | Directed to web tool |
| `t2uay3k.sj1i4kz` | 77 | Directed to custom GPT tool |
| `file_search.msearch` | 27 | Directed to file search |
| `browser.find` | 23 | Directed to browser find |
| `container.exec` | 21 | Directed to container |
| `browser.search` | 21 | Directed to browser search |
| `computer.do` | 17 | Directed to computer use |
| `api_tool.call_tool` | 16 | Directed to API tool |
| `api_tool.list_resources` | 12 | Directed to API resource listing |
| `mtbrowser.search` | 4 | Directed to multi-tab browser |
| `computer.get` | 4 | Directed to computer use |
| `computer.sync_file` | 3 | Directed to computer file sync |
| `imagegen.make_image` | 2 | Directed to image generation |
| `research_kickoff_tool.start_research_task` | 1 | Directed to deep research |
| `computer.initialize` | 1 | Directed to computer init |
| `container.open_image` | 1 | Directed to container image |

## 1.4 Message Content (12 content types)

### `text` (9,756 occurrences)
```typescript
{ content_type: "text"; parts: (string | ContentPart)[] }
```
Parts are almost always strings. The primary user and assistant message type.

### `multimodal_text` (139 occurrences)
```typescript
{ content_type: "multimodal_text"; parts: (string | ContentPart)[] }
```
Mixed content: text strings interleaved with structured parts. Non-string parts are one of 4 variants:

**`image_asset_pointer`** (130 occurrences):
```typescript
{
  content_type: "image_asset_pointer";
  asset_pointer: string;              // "sediment://file_{hex}" or "file-service://file-{id}"
  size_bytes: number;
  width: number;
  height: number;
  fovea: unknown | null;
  metadata: {
    dalle?: { gen_id: string; prompt: string; seed: number; [key: string]: unknown };
    gizmo?: unknown;
    generation?: { gen_id: string; gen_size: string; seed: number; height: number; width: number; orientation: string; [key: string]: unknown };
    container_pixel_height?: number;
    container_pixel_width?: number;
    emu_omit_glimpse_image?: unknown;
    emu_patches_override?: unknown;
    lpe_keep_patch_ijhw?: unknown;
    lpe_delta_encoding_channel?: unknown;
    sanitized?: boolean;
    asset_pointer_link?: string | null;
    watermarked_asset_pointer?: string | null;
    is_no_auth_placeholder?: boolean | null;
  };
}
```

**`audio_transcription`** (6 occurrences):
```typescript
{
  content_type: "audio_transcription";
  decoding_id: string;
  direction: string;
  text: string;
}
```

**`real_time_user_audio_video_asset_pointer`** (3 occurrences):
```typescript
{
  content_type: "real_time_user_audio_video_asset_pointer";
  audio_asset_pointer: string;
  audio_start_timestamp: number;
  expiry_datetime: string;
  frames_asset_pointers: string[];
  video_container_asset_pointer: string;
}
```

**`audio_asset_pointer`** (3 occurrences):
```typescript
{
  content_type: "audio_asset_pointer";
  asset_pointer: string;
  expiry_datetime: string;
  format: string;
  metadata: Record<string, unknown>;
  size_bytes: number;
  tool_audio_direction: string;
}
```

### `thoughts` (3,508 occurrences)
```typescript
{
  content_type: "thoughts";
  thoughts: string;                    // JSON-encoded array of ThoughtItem
  source_analysis_msg_id?: string;
}

interface ThoughtItem {
  summary: string;      // Short title
  content: string;      // Full thought text
  chunks: unknown[];    // Chunk data
  finished: boolean;    // Whether thought is complete
}
```
Note: `thoughts` field is a **JSON string** that must be parsed to get the array.

### `code` (2,875 occurrences)
```typescript
{
  content_type: "code";
  language: string;
  response_format_name: string | null;
  text: string;
}
```

### `reasoning_recap` (1,173 occurrences)
```typescript
{ content_type: "reasoning_recap"; content: string }
```

### `user_editable_context` (622 occurrences)
```typescript
{
  content_type: "user_editable_context";
  user_profile: string;
  user_instructions: string;
}
```

### `execution_output` (247 occurrences)
```typescript
{ content_type: "execution_output"; text: string }
```

### `tether_browsing_display` (171 occurrences)
```typescript
{
  content_type: "tether_browsing_display";
  result: string;
  summary: string | null;
  assets: unknown[];
  tether_id: string | null;
}
```

### `sonic_webpage` (83 occurrences)
```typescript
{
  content_type: "sonic_webpage";
  url: string;
  domain: string;
  title: string;
  text: string;
  snippet: string;
  pub_date: string | null;
  crawl_date: string;
  pub_timestamp: number | null;
  crawl_timestamp: number;
  ref_id: string;
}
```

### `computer_output` (22 occurrences)
```typescript
{
  content_type: "computer_output";
  computer_id: string;
  screenshot: string;
  tether_id: string;
  state: string;
  is_ephemeral: boolean;
}
```

### `model_editable_context` (2 occurrences)
```typescript
{
  content_type: "model_editable_context";
  model_set_context: string;
  repository: unknown;
  repo_summary: string;
  structured_context: unknown;
}
```

### `system_error` (1 occurrence)
```typescript
{
  content_type: "system_error";
  name: string;
  text: string;
}
```

## 1.5 Message Metadata (118 unique keys)

### Key metadata fields relevant to display

| Key | Frequency | Type | Purpose |
|-----|-----------|------|---------|
| `model_slug` | 13,788 | string | Model used (see §1.5.1) |
| `default_model_slug` | 13,788 | string | Default model for conversation |
| `is_visually_hidden_from_conversation` | 3,932 | boolean | Should be hidden from display |
| `finish_details` | 3,623 | object | How generation ended (see §1.5.2) |
| `message_type` | 13,788 | string | "next" or "suggestion" |
| `citations` | 7,577 | string[] | Citation references |
| `content_references` | 7,577 | unknown[] | Content reference objects |
| `attachments` | 75 | unknown[] | File attachments |
| `image_gen_title` | 83 | string | DALL-E generation title |
| `is_user_system_message` | 628 | boolean | System instruction message |
| `dictation` | 376 | unknown | Voice dictation data |
| `aggregate_result` | 248 | object | Code execution results |
| `reasoning_status` | 11,807 | unknown | Reasoning state |
| `thinking_effort` | 10,213 | unknown | Thinking effort level |
| `can_save` | 18,716 | boolean | Whether message can be saved |
| `turn_exchange_id` | 15,644 | string | Turn exchange identifier |
| `request_id` | 15,110 | string | Request identifier |
| `parent_id` | 14,302 | string | Parent message ID |

### All 118 metadata keys by frequency

**High frequency (>1000):**
`can_save` (18,716), `turn_exchange_id` (15,644), `request_id` (15,110), `parent_id` (14,302), `message_type` (13,788), `model_slug` (13,788), `default_model_slug` (13,788), `reasoning_status` (11,807), `thinking_effort` (10,213), `classifier_response` (10,125), `model_switcher_deny` (8,978), `citations` (7,577), `content_references` (7,577), `reasoning_title` (6,542), `is_visually_hidden_from_conversation` (3,932), `is_complete` (3,829), `finish_details` (3,623), `skip_reasoning_title` (3,367), `search_result_groups` (2,900), `debug_sonic_thread_id` (2,549), `message_source` (1,449), `search_display_string` (1,372), `searched_display_string` (1,372), `is_contextual_answers_system_message` (1,323), `contextual_answers_message_type` (1,323), `search_model_queries` (1,321), `search_queries` (1,321), `finished_duration_sec` (1,202), `disable_turn_actions` (1,107), `hide_inline_actions` (1,105), `timestamp_` (1,014), `resolved_model_slug` (1,012)

**Medium frequency (100-1000):**
`command` (873), `developer_mode_connector_ids` (814), `selected_github_repos` (814), `serialization_metadata` (814), `selected_sources` (802), `reasoning_start_time` (797), `rebase_developer_message` (737), `safe_urls` (713), `is_user_system_message` (628), `user_context_message_data` (624), `n7jupd_message` (500), `n7jupd_subtool` (498), `reasoning_group_id` (497), `dictation` (376), `triggered_by_system_hint_suggestion` (374), `chime_version` (366), `aggregate_result` (248), `token_count` (218), `permissions` (217), `source` (215), `async_source` (197), `stream_topic_id` (177), `is_temporal_turn` (161), `clicked_from_url` (134), `clicked_from_title` (134), `connector_source` (134), `display_url` (134), `display_title` (134), `n7jupd_title` (123), `gizmo_id` (122), `n7jupd_url` (113), `status` (104)

**Low frequency (<100):**
`async_task_id` (95), `async_task_type` (90), `async_task_title` (87), `image_gen_title` (83), `attachments` (75), `reasoning_end_time` (57), `response_message_id` (49), `system_hints` (44), `async_task_original_message_id` (40), `retrieval_turn_number` (37), `invoked_plugin` (34), `requested_model_slug` (31), `retrieval_search_sources` (26), `cloud_doc_urls` (25), `is_contextual_answers_supported` (25), `contextual_answers_available_sources` (25), `rebase_system_message` (21), `poll_on_websocket_inactivity_ms` (21), `poll_freshness_max_mins` (21), `poll_interval_ms` (21), `async_completion_id` (21), `n7jupd_titles` (21), `n7jupd_urls` (21), `n7jupd_v` (21), `finished_text` (20), `initial_text` (20), `summarization_headline` (20), `pro_skipped` (20), `tool_invoking_message` (19), `tool_invoked_message` (19), `invoked_resource` (19), `async_task_conversation_id` (18), `async_task_created_at` (18), `is_async_task_result_message` (18), `async_completion_message` (18), `connectors_file_search` (15), `chatgpt_sdk` (14), `retrieval_file_index` (12), `is_thinking_preamble_message` (11), `code_blocks` (9), `suggested_connector_ids` (5), `cta_by_suggested_connector_id` (5), `generation_index` (4), `image_gen_group_id` (4), `image_gen_paragen_metadata` (4), `search_turns_count` (3), `search_source` (3), `client_reported_search_source` (3), `targeted_reply` (3), `caterpillar_selected_sources` (3), `selected_mcp_sources` (3), `async_task_message_label` (3), `jit_plugin_data` (3), `voice_mode_message` (3), `real_time_audio_has_video` (3), `stop_reason` (3), `n7jupd_crefs` (3), `content_references_by_file` (3), `n7jupd_crefs_by_file` (3), `deep_research_version` (2), `chatgpt_sdk_suppressed_response` (2), `venus_message` (2), `venus_message_type` (2), `venus_widget_state` (2), `targeted_reply_source_message_id` (2), `targeted_reply_source_range` (2), `prompt_expansion_predictions` (2), `default_view` (2), `needs_startup` (2), `agent_entrypoint` (2), `agent_kickoff_source` (2), `n7jupd_schedulable` (2), `n7jupd_summary` (2), `is_loading_message` (1), `async_task_prompt` (1), `async_task_status_messages` (1), `b1de6e2_s` (1), `b1de6e2_rm` (1), `venus_model_variant` (1), `is_contextual_retry_user_message` (1), `is_visually_hidden_reasoning_group` (1), `is_error` (1), `selected_image_message_id` (1), `image_gen_multi_stream` (1)

### 1.5.1 Model Slugs (19 unique values)

| Model | Count |
|-------|-------|
| `gpt-5-2-thinking` | 10,040 |
| `gpt-5-1-thinking` | 3,345 |
| `gpt-5-4-thinking` | 461 |
| `gpt-5-2-instant` | 54 |
| `gpt-5-1-instant` | 29 |
| `gpt-5-2-pro` | 28 |
| `gpt-4o` | 14 |
| `o3` | 14 |
| `gpt-5-1-pro` | 12 |
| `gpt-4-1` | 12 |
| `gpt-5-2` | 8 |
| `research` | 6 |
| `gpt-5` | 5 |
| `gpt-5-mini` | 4 |
| `gpt-5-pro` | 3 |
| `gpt-5-instant` | 3 |
| `gpt-5-1` | 3 |
| `gpt-5-4-pro` | 2 |
| `agent-mode` | 2 |

### 1.5.2 Finish Details

```typescript
type FinishDetails =
  | { type: "stop"; stop_tokens?: number[] }     // Normal completion (stop_tokens: 200012, 200002, 200007)
  | { type: "interrupted"; reason: string };      // e.g. "client_stopped" (82 occurrences)
```

## 1.6 Asset Storage

**On disk:** `output/assets/{conversation_id}/{filename}`

**Asset pointer formats (3 schemes):**
1. `sediment://file_{hex_id}` — 147 unique values (dominant)
2. `sediment://{hash}#file_{hex_id}#p_N.jpg` — 8 values (PDF page renders)
3. `file-service://file-{alphanumeric_id}` — 8 values (legacy)

**Total unique asset pointers observed:** 155

**Resolution:** The ETL tool resolves pointers via `/backend-api/files/download/{file_id}` and saves the binary to the assets directory.

## 1.7 Manifest File

Located at `output/manifest.json`:

```typescript
interface ExportManifest {
  version: 1;
  exportedAt: string;                                      // ISO 8601
  conversations: Record<string, ManifestConversation>;
}

interface ManifestConversation {
  id: string;
  title: string;
  status: "pending" | "complete" | "error";
  error?: string;
  assetCount: number;
}
```

## 1.8 Completeness Note

This spec is derived from scanning 656 of ~1,171 conversations. The remaining conversations may contain:
- Additional `content_type` values not listed here
- Additional `author.name` / `recipient` values
- Additional `metadata` keys
- Additional asset pointer schemes

**Consumers MUST handle unknown values gracefully** — unknown content types should render as raw JSON with a label, unknown metadata keys should display in the metadata panel, and unknown asset pointer schemes should show the raw pointer string. The spec documents observed patterns, not an exhaustive closed set.

## 1.9 Visibility Rules

Messages should be hidden from the conversation view when:
1. `message` is `null` (root node)
2. `message.metadata.is_visually_hidden_from_conversation` is `true`
3. `message.weight === 0` AND the message is not on the active branch
4. `message.author.role === "system"` (system setup messages)
5. `message.channel === "commentary"` (internal commentary)
6. `message.content.content_type === "user_editable_context"` (custom instructions)
7. `message.content.content_type === "model_editable_context"` (model context)

Messages that should be **visually distinct** but shown:
- `content_type === "thoughts"` — collapsible thinking block
- `content_type === "code"` — code block with syntax highlighting
- `content_type === "execution_output"` — output block
- `content_type === "reasoning_recap"` — summary block
- `status === "in_progress"` — show as incomplete/streaming
