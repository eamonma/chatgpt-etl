import { readFile, writeFile, rename } from "fs/promises";
import { join } from "path";
import type { ExportManifest, ManifestConversation } from "../types.js";

const MANIFEST_FILENAME = "manifest.json";

export async function loadManifest(
  outputDir: string
): Promise<ExportManifest | null> {
  const manifestPath = join(outputDir, MANIFEST_FILENAME);
  try {
    const contents = await readFile(manifestPath, "utf8");
    return JSON.parse(contents) as ExportManifest;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function saveManifest(
  outputDir: string,
  manifest: ExportManifest
): Promise<void> {
  const manifestPath = join(outputDir, MANIFEST_FILENAME);
  const tmpPath = manifestPath + ".tmp";
  const json = JSON.stringify(manifest, null, 2);
  await writeFile(tmpPath, json, "utf8");
  await rename(tmpPath, manifestPath);
}

export function markConversation(
  manifest: ExportManifest,
  id: string,
  update: Partial<ManifestConversation>
): ExportManifest {
  return {
    ...manifest,
    conversations: {
      ...manifest.conversations,
      [id]: {
        ...manifest.conversations[id],
        ...update,
      },
    },
  };
}
