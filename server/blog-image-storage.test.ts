import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import {
  BlogImageStorageError,
  deleteBlogImages,
  downloadBlogImage,
  downloadBlogImagePreview,
  uploadBlogImage,
} from "./blog-image-storage";

test("local blog image storage supports Plesk upload, preview, and cleanup", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "blog-image-storage-"));
  const previousDirectory = process.env.BLOG_IMAGE_STORAGE_DIR;
  const previousDriver = process.env.BLOG_IMAGE_STORAGE_DRIVER;
  process.env.BLOG_IMAGE_STORAGE_DIR = directory;
  process.env.BLOG_IMAGE_STORAGE_DRIVER = "local";

  try {
    const source = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: "#e91e63",
      },
    }).png().toBuffer();

    const key = await uploadBlogImage("blog/7/example.webp", source);
    assert.equal(key, "local:blog/7/example.webp");
    assert.ok((await downloadBlogImage(key))?.length);
    assert.ok((await downloadBlogImagePreview(key))?.length);
    await deleteBlogImages([key]);
    assert.equal(await downloadBlogImage(key), null);
    await assert.rejects(
      () => downloadBlogImage("local:../outside.webp"),
      BlogImageStorageError,
    );
  } finally {
    if (previousDirectory === undefined) delete process.env.BLOG_IMAGE_STORAGE_DIR;
    else process.env.BLOG_IMAGE_STORAGE_DIR = previousDirectory;
    if (previousDriver === undefined) delete process.env.BLOG_IMAGE_STORAGE_DRIVER;
    else process.env.BLOG_IMAGE_STORAGE_DRIVER = previousDriver;
    await rm(directory, { recursive: true, force: true });
  }
});
