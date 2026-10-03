// Copies the ZXing reader binary next to the app so barcode/QR scanning works
// without a CDN and always matches the installed zxing-wasm version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
mkdirSync("public/zxing", { recursive: true });
copyFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm"), "public/zxing/zxing_reader.wasm");
