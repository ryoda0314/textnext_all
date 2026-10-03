// Derives the PWA icon variants from the TextNext app icon (public/icons/icon-512.png,
// the same mark as the original TextNext). Run: node scripts/generate-icons.mjs
import sharp from "sharp";

const src = "public/icons/icon-512.png";

// Maskable: keep the mark inside the safe zone on a white square.
const inner = await sharp(src).resize(368, 368).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#ffffff" } })
  .composite([{ input: inner, top: 72, left: 72 }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");

await sharp(src).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(src).resize(180, 180).flatten({ background: "#ffffff" }).png().toFile("public/icons/apple-touch-icon.png");
await sharp(src).resize(64, 64).png().toFile("app/icon.png");

// Monochrome status-bar badge for Android notifications.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text x="48" y="72" font-family="Arial, sans-serif" font-size="76" font-weight="700" text-anchor="middle" fill="#fff">T</text></svg>`;
await sharp(Buffer.from(badge)).png().toFile("public/icons/badge-96.png");
console.log("icons written");
