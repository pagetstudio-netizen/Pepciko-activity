import { Client } from "@replit/object-storage";
import sharp from "sharp";

const MAX_OUTPUT_BYTES = 900 * 1024;
let appStorage: Client | undefined;

function getAppStorage(): Client {
  if (!appStorage) appStorage = new Client();
  return appStorage;
}

function resetAppStorage(client: Client): void {
  if (appStorage === client) appStorage = undefined;
}

export class BlogImageValidationError extends Error {}
export class BlogImageStorageError extends Error {}

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

export async function uploadBlogImage(objectName: string, input: Buffer): Promise<void> {
  const optimized = await optimizeBlogImage(input);
  const client = getAppStorage();

  try {
    const result = await client.uploadFromBytes(objectName, optimized, { compress: false });
    if (!result.ok) {
      throw result.error;
    }
  } catch {
    resetAppStorage(client);
    throw new BlogImageStorageError(
      "Le stockage des captures est indisponible. Réessayez dans quelques instants.",
    );
  }
}

export async function downloadBlogImage(objectName: string): Promise<Buffer | null> {
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
  const client = getAppStorage();
  const outcomes = await Promise.allSettled(
    objectNames.map(async (objectName) => client.delete(objectName, { ignoreNotFound: true })),
  );

  if (outcomes.some((outcome) => outcome.status === "rejected" || !outcome.value.ok)) {
    resetAppStorage(client);
    console.warn("[blog] Some temporary images could not be cleaned up.");
  }
}
