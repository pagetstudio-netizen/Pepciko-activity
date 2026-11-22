import { Client } from "@replit/object-storage";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_OUTPUT_BYTES = 900 * 1024;
const LOCAL_KEY_PREFIX = "local:";
const REPLIT_KEY_PREFIX = "replit:";
let appStorage: Client | undefined;

export class BlogImageValidationError extends Error {}
export class BlogImageStorageError extends Error {}

function useReplitStorage(): boolean {
  if (process.env.BLOG_IMAGE_STORAGE_DRIVER?.trim().toLowerCase() === "local") {
    return false;
  }
  return Boolean(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT === "1");
}

function getLocalImagePath(objectName: string): string {
  const name = objectName.startsWith(LOCAL_KEY_PREFIX)
    ? objectName.slice(LOCAL_KEY_PREFIX.length)
    : objectName;
  const segments = name.split("/");
  if (
    !name
    || name.startsWith(REPLIT_KEY_PREFIX)
    || name.includes("\\")
    || segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment))
  ) {
    throw new BlogImageStorageError("Référence de capture invalide.");
  }

  const configuredDirectory = process.env.BLOG_IMAGE_STORAGE_DIR?.trim();
  const root = path.resolve(
    configuredDirectory || path.join(process.env.HOME || process.cwd(), ".pepsico-blog-images"),
  );
  const imagePath = path.resolve(root, ...segments);
  if (!imagePath.startsWith(`${root}${path.sep}`)) {
    throw new BlogImageStorageError("Référence de capture invalide.");
  }
  return imagePath;
}

function getAppStorage(): Client {
  if (!appStorage) appStorage = new Client();
  return appStorage;
}

function resetAppStorage(client: Client): void {
  if (appStorage === client) appStorage = undefined;
}

async function optimizeBlogImage(input: Buffer): Promise<Buffer> {
  let metadata;
  try {
    metadata = await sharp(input, {
      limitInputPixels: 20_000_000,
      animated: false,
    }).metadata();
  } catch {
    throw new BlogImageValidationError("Une capture n’est pas une image valide.");
  }

  if (
    !metadata.width
    || !metadata.height
    || metadata.pages && metadata.pages > 1
    || !["jpeg", "png", "webp"].includes(metadata.format || "")
  ) {
    throw new BlogImageValidationError("Utilisez une image JPEG, PNG ou WebP non animée.");
  }

  let optimized: Buffer;
  try {
    optimized = await sharp(input, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize({ width: 1440, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76, effort: 4 })
      .toBuffer();

    if (optimized.byteLength > MAX_OUTPUT_BYTES) {
      optimized = await sharp(input, { limitInputPixels: 20_000_000 })
        .rotate()
        .resize({ width: 1100, height: 1100, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 62, effort: 4 })
        .toBuffer();
    }
  } catch {
    throw new BlogImageValidationError("Cette capture ne peut pas être compressée.");
  }

  if (optimized.byteLength > MAX_OUTPUT_BYTES) {
    throw new BlogImageValidationError("Une capture compressée ne peut pas dépasser 900 Ko.");
  }

  return optimized;
}

export async function uploadBlogImage(objectName: string, input: Buffer): Promise<string> {
  const optimized = await optimizeBlogImage(input);
  if (!useReplitStorage()) {
    try {
      const imagePath = getLocalImagePath(objectName);
      await mkdir(path.dirname(imagePath), { recursive: true, mode: 0o700 });
      await writeFile(imagePath, optimized, { flag: "wx", mode: 0o600 });
      return `${LOCAL_KEY_PREFIX}${objectName}`;
    } catch {
      throw new BlogImageStorageError(
        "Le stockage local des captures est indisponible. Vérifiez le dossier d’images Plesk.",
      );
    }
  }

  const client = getAppStorage();

  try {
    const result = await client.uploadFromBytes(objectName, optimized, { compress: false });
    if (!result.ok) {
      throw result.error;
    }
    return `${REPLIT_KEY_PREFIX}${objectName}`;
  } catch {
    resetAppStorage(client);
    throw new BlogImageStorageError(
      "Le stockage des captures est indisponible. Réessayez dans quelques instants.",
    );
  }
}

export async function downloadBlogImage(objectName: string): Promise<Buffer | null> {
  if (objectName.startsWith(REPLIT_KEY_PREFIX) && !useReplitStorage()) return null;
  if (objectName.startsWith(LOCAL_KEY_PREFIX) || !useReplitStorage()) {
    try {
      return await readFile(getLocalImagePath(objectName));
    } catch (error) {
      if (error instanceof BlogImageStorageError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new BlogImageStorageError("Le stockage local des captures est indisponible.");
    }
  }
  if (objectName.startsWith(REPLIT_KEY_PREFIX)) {
    objectName = objectName.slice(REPLIT_KEY_PREFIX.length);
  }

  const client = getAppStorage();
  try {
    const result = await client.downloadAsBytes(objectName);
    if (!result.ok) return null;
    return result.value[0] ?? null;
  } catch {
    resetAppStorage(client);
    throw new BlogImageStorageError("Le stockage des captures est indisponible.");
  }
}

export async function downloadBlogImagePreview(objectName: string): Promise<Buffer | null> {
  const image = await downloadBlogImage(objectName);
  if (!image) return null;
  try {
    return await sharp(image, { limitInputPixels: 20_000_000 })
      .resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 58, effort: 3 })
      .toBuffer();
  } catch {
    throw new BlogImageValidationError("Cette capture ne peut pas être affichée.");
  }
}

export async function deleteBlogImages(objectNames: string[]): Promise<void> {
  const outcomes = await Promise.allSettled(
    objectNames.map(async (objectName) => {
      if (objectName.startsWith(REPLIT_KEY_PREFIX) && !useReplitStorage()) return;
      if (objectName.startsWith(LOCAL_KEY_PREFIX) || !useReplitStorage()) {
        await rm(getLocalImagePath(objectName), { force: true });
        return;
      }

      const client = getAppStorage();
      const key = objectName.startsWith(REPLIT_KEY_PREFIX)
        ? objectName.slice(REPLIT_KEY_PREFIX.length)
        : objectName;
      const result = await client.delete(key, { ignoreNotFound: true });
      if (!result.ok) throw result.error;
    }),
  );

  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    console.warn("[blog] Some temporary images could not be cleaned up.");
  }
}
