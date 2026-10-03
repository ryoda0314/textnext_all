import { storagePublicUrl } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import type { ItemImage } from "@/lib/types";

export function itemImageUrl(image: ItemImage | undefined, variant: "full" | "thumb" = "thumb") {
  if (!image) return null;
  const path = variant === "thumb" ? (image.thumb ?? image.path) : image.path;
  return storagePublicUrl("item-images", path);
}

export function itemThumbUrl(path: string | null | undefined) {
  return path ? storagePublicUrl("item-images", path) : null;
}

export class ImageError extends Error {}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } catch {
      throw new ImageError("この画像は読み込めませんでした。JPEG・PNG形式の写真を選んでください");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encodes an image in the browser: fixes orientation, resizes, strips metadata
 * (including GPS), and prefers WebP with a JPEG fallback.
 */
export async function encodeImage(file: Blob, maxEdge: number, quality = 0.82) {
  const decoded = await decode(file);
  const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("画像を処理できませんでした");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decoded.source, 0, 0, width, height);
  decoded.close?.();

  let blob = await toBlob(canvas, "image/webp", quality);
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", 0.85);
    ext = "jpg";
  }
  if (!blob) throw new ImageError("画像を処理できませんでした");
  return { blob, width, height, ext };
}

/** Uploads a listing photo + thumbnail into <university>/<user>/ and returns the stored paths. */
export async function uploadItemImage(file: Blob, universityId: string, userId: string): Promise<ItemImage> {
  const supabase = getSupabase();
  const [full, thumb] = await Promise.all([encodeImage(file, 1400, 0.82), encodeImage(file, 480, 0.78)]);
  const id = crypto.randomUUID();
  const base = `${universityId}/${userId}/${id}`;
  const path = `${base}.${full.ext}`;
  const thumbPath = `${base}_t.${thumb.ext}`;
  const upload = (p: string, blob: Blob) =>
    supabase.storage.from("item-images").upload(p, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  const [a, b] = await Promise.all([upload(path, full.blob), upload(thumbPath, thumb.blob)]);
  if (a.error || b.error) throw new ImageError("写真のアップロードに失敗しました。通信環境を確認してもう一度お試しください");
  return { path, thumb: thumbPath, w: full.width, h: full.height };
}

export async function removeItemImages(paths: string[]) {
  if (paths.length === 0) return;
  await getSupabase().storage.from("item-images").remove(paths);
}

export async function uploadAvatar(file: Blob, userId: string) {
  const encoded = await encodeImage(file, 400, 0.85);
  const path = `${userId}/${crypto.randomUUID()}.${encoded.ext}`;
  const { error } = await getSupabase()
    .storage.from("avatars")
    .upload(path, encoded.blob, { contentType: encoded.blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new ImageError("画像のアップロードに失敗しました");
  return path;
}

export async function uploadChatImage(file: Blob, tradeId: string) {
  const encoded = await encodeImage(file, 1400, 0.8);
  const path = `${tradeId}/${crypto.randomUUID()}.${encoded.ext}`;
  const { error } = await getSupabase()
    .storage.from("chat-images")
    .upload(path, encoded.blob, { contentType: encoded.blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new ImageError("画像を送信できませんでした");
  return path;
}
