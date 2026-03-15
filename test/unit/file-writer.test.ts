import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeConversation, writeAsset } from "../../src/persistence/file-writer.js";

describe("writeConversation", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "file-writer-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates conversations/{id}.json with the given data", async () => {
    const id = "conv-abc123";
    const data = JSON.stringify({ id, title: "Test Conversation" });

    await writeConversation(tmpDir, id, data);

    const filePath = join(tmpDir, "conversations", `${id}.json`);
    const contents = await readFile(filePath, "utf-8");
    expect(contents).toBe(data);
  });

  it("creates parent directories as needed", async () => {
    const id = "conv-xyz";
    const data = '{"id":"conv-xyz"}';

    await writeConversation(tmpDir, id, data);

    const filePath = join(tmpDir, "conversations", `${id}.json`);
    await expect(access(filePath)).resolves.toBeUndefined();
  });
});

describe("writeAsset", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "file-writer-asset-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates assets/{conversationId}/{fileName} with the given buffer", async () => {
    const conversationId = "conv-abc";
    const fileName = "file-001.png";
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    await writeAsset(tmpDir, conversationId, fileName, data);

    const filePath = join(tmpDir, "assets", conversationId, fileName);
    const contents = await readFile(filePath);
    expect(contents).toEqual(data);
  });

  it("creates nested directories as needed", async () => {
    const conversationId = "conv-nested";
    const fileName = "document.pdf";
    const data = Buffer.from("PDF content");

    await writeAsset(tmpDir, conversationId, fileName, data);

    const filePath = join(tmpDir, "assets", conversationId, fileName);
    await expect(access(filePath)).resolves.toBeUndefined();
  });
});

describe("idempotency", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "file-writer-idempotent-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writeConversation does not overwrite a file with identical content", async () => {
    const id = "conv-idempotent";
    const data = JSON.stringify({ id, title: "Stable" });

    await writeConversation(tmpDir, id, data);

    const filePath = join(tmpDir, "conversations", `${id}.json`);
    const { mtimeMs: mtime1 } = await import("node:fs/promises").then((fs) =>
      fs.stat(filePath),
    );

    // Small delay to ensure mtime would differ if a write occurred
    await new Promise((r) => setTimeout(r, 10));

    await writeConversation(tmpDir, id, data);

    const { mtimeMs: mtime2 } = await import("node:fs/promises").then((fs) =>
      fs.stat(filePath),
    );

    expect(mtime2).toBe(mtime1);
  });

  it("writeConversation overwrites when content differs", async () => {
    const id = "conv-changed";
    const data1 = JSON.stringify({ id, title: "Original" });
    const data2 = JSON.stringify({ id, title: "Updated" });

    await writeConversation(tmpDir, id, data1);
    await writeConversation(tmpDir, id, data2);

    const filePath = join(tmpDir, "conversations", `${id}.json`);
    const contents = await readFile(filePath, "utf-8");
    expect(contents).toBe(data2);
  });

  it("writeAsset does not overwrite a file with identical content", async () => {
    const conversationId = "conv-idem";
    const fileName = "image.png";
    const data = Buffer.from([1, 2, 3, 4]);

    await writeAsset(tmpDir, conversationId, fileName, data);

    const filePath = join(tmpDir, "assets", conversationId, fileName);
    const { mtimeMs: mtime1 } = await import("node:fs/promises").then((fs) =>
      fs.stat(filePath),
    );

    await new Promise((r) => setTimeout(r, 10));

    await writeAsset(tmpDir, conversationId, fileName, data);

    const { mtimeMs: mtime2 } = await import("node:fs/promises").then((fs) =>
      fs.stat(filePath),
    );

    expect(mtime2).toBe(mtime1);
  });

  it("writeAsset overwrites when content differs", async () => {
    const conversationId = "conv-asset-changed";
    const fileName = "file.bin";
    const data1 = Buffer.from([0x01]);
    const data2 = Buffer.from([0x02]);

    await writeAsset(tmpDir, conversationId, fileName, data1);
    await writeAsset(tmpDir, conversationId, fileName, data2);

    const filePath = join(tmpDir, "assets", conversationId, fileName);
    const contents = await readFile(filePath);
    expect(contents).toEqual(data2);
  });
});
