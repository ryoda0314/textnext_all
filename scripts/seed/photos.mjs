// Listing photos for the test data, drawn as SVG and encoded with sharp: a book on the
// seller's desk (cover, an inside page with the seller's notes, or the back cover).
import sharp from "sharp";

const W = 900;
const H = 1200;
const FONT = "'Yu Gothic', 'Hiragino Sans', 'Noto Sans CJK JP', 'Noto Sans JP', Meiryo, sans-serif";

// Each seller photographs on their own desk.
const DESKS = {
  wood: ["#e9d8bb", "#d2b98f"],
  gray: ["#e8e8e6", "#cdcdca"],
  white: ["#f5f3ef", "#dfdad2"],
  blue: ["#e6ebf1", "#cbd4de"],
  dark: ["#a29a8e", "#7f776c"],
};

function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) | 0;
  return Math.abs(h);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const charWidth = (ch, size) => (/[\x20-\x7e]/.test(ch) ? size * 0.56 : size);
const textWidth = (text, size) => [...text].reduce((w, ch) => w + charWidth(ch, size), 0);

// Phrases a line may break between: after 「・」「／」 or a space, before 「（」, around Latin words.
function phrases(text) {
  const out = [];
  let current = "";
  const chars = [...text];
  chars.forEach((ch, i) => {
    if (ch === "（" && current) {
      out.push(current);
      current = "";
    }
    current += ch;
    if (/[・／\s]/.test(ch) && !/\s/.test(chars[i + 1] ?? "")) {
      out.push(current);
      current = "";
    }
  });
  if (current) out.push(current);
  return out.flatMap((p) => p.split(/(?<=[A-Za-z]{4,})(?=[^\sA-Za-z.'’-])|(?<=[^\sA-Za-z])(?=[A-Za-z]{4,})/u)).filter(Boolean);
}

// Wraps by phrase; a phrase is split by character only when it is wider than a line.
function wrap(text, size, max) {
  const lines = [];
  let line = "";
  let split = false;
  for (const phrase of phrases(text)) {
    if (textWidth(line + phrase.trimEnd(), size) <= max) {
      line += phrase;
      continue;
    }
    if (line.trim()) lines.push(line.trim());
    line = "";
    for (const ch of phrase) {
      if (line && textWidth(line + ch, size) > max) {
        lines.push(line.trim());
        line = "";
        split = true;
      }
      line += ch;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return { lines, split };
}

function fitTitle(title, max) {
  for (const size of [66, 58, 50, 44]) {
    const { lines, split } = wrap(title, size, max);
    if (lines.length <= 3 && !split) return { size, lines };
  }
  return { size: 40, lines: wrap(title, 40, max).lines };
}

function isLight(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

function frame(desk, seed, body) {
  const [light, dark] = DESKS[desk] ?? DESKS.gray;
  const angle = ((seed % 41) - 20) / 10; // -2.0° … 2.0°
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="desk" cx="45%" cy="40%" r="80%"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="18"/><feOffset dx="8" dy="16"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#desk)"/>
  <g transform="rotate(${angle} ${W / 2} ${H / 2})" filter="url(#shadow)">${body}</g>
</svg>`;
}

// The book occupies x 150–750, y 170–1010 inside the frame.
const BX = 150;
const BY = 170;
const BW = 600;
const BH = 840;

function bookBlock(inner, { worn = false } = {}) {
  return `
    <rect x="${BX + 10}" y="${BY + 9}" width="${BW}" height="${BH}" rx="4" fill="#f4efe4" stroke="#d9d1c2"/>
    ${inner}
    <rect x="${BX}" y="${BY}" width="16" height="${BH}" fill="#000" fill-opacity="0.12"/>
    ${worn ? `<path d="M${BX + BW} ${BY + BH - 46} L${BX + BW - 46} ${BY + BH} L${BX + BW} ${BY + BH} Z" fill="#fff" fill-opacity="0.35"/>` : ""}`;
}

function lines(texts, { x, y, size, leading = 1.25, fill, anchor = "start", weight = 400 }) {
  return texts
    .map((t, i) => `<text x="${x}" y="${y + i * size * leading}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="${FONT}">${esc(t)}</text>`)
    .join("");
}

// Three cover layouts: "solid" (title on a plain colour), "band" (colour band over cream),
// "frame" (centred title inside a keyline).
function coverSvg(book, desk) {
  const c = book.cover;
  const seed = hash(book.title);
  const centred = c.style === "frame";
  const x = centred ? BX + BW / 2 : BX + 56;
  const anchor = centred ? "middle" : "start";
  const light = isLight(c.color);
  const titleInk = light ? "#22201c" : "#ffffff";
  const softInk = light ? "rgba(34,32,28,0.72)" : "rgba(255,255,255,0.8)";
  const bodyInk = c.style === "band" ? "#5d564c" : softInk;

  const title = fitTitle(book.title, BW - 112 - (centred ? 40 : 0));
  const seriesY = BY + (centred ? 110 : 76);
  const titleY = (c.series ? seriesY + 40 : BY + (centred ? 120 : 80)) + title.size;
  const titleEnd = titleY + (title.lines.length - 1) * title.size * 1.2;

  const bandH = Math.max(titleEnd - BY + 80, BH * 0.46);
  const background =
    c.style === "band"
      ? `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="4" fill="#f3efe6"/>
         <rect x="${BX}" y="${BY}" width="${BW}" height="${bandH}" rx="4" fill="${c.color}"/>
         <rect x="${BX + 56}" y="${BY + bandH - 24}" width="64" height="8" fill="${c.accent ?? "#e8c25a"}"/>`
      : c.style === "frame"
        ? `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="4" fill="${c.color}"/>
           <rect x="${BX + 30}" y="${BY + 30}" width="${BW - 60}" height="${BH - 60}" fill="none" stroke="${c.accent ?? "#d8c48a"}" stroke-width="3"/>`
        : `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="4" fill="${c.color}"/>
           <circle cx="${BX + BW - 30}" cy="${BY + BH * 0.6}" r="${170 + (seed % 50)}" fill="${light ? "#000" : "#fff"}" fill-opacity="0.06" clip-path="url(#face)"/>
           <rect x="${BX + 56}" y="${BY + BH * 0.72}" width="${BW - 112}" height="5" fill="${c.accent ?? "#e8c25a"}"/>`;

  const subtitleY = c.style === "band" ? BY + bandH + 66 : titleEnd + 64;
  const authorLines = wrap(book.author ?? "", 28, BW - 112).lines.slice(0, 2);
  const authorY = c.style === "solid" ? subtitleY + (c.subtitle ? 64 : 0) : BY + BH - 150 - (authorLines.length - 1) * 35;

  const face = `
    <clipPath id="face"><rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="4"/></clipPath>
    ${background}
    ${c.series ? lines([c.series], { x, y: seriesY, size: 24, fill: c.style === "band" ? "rgba(255,255,255,0.82)" : softInk, anchor }) : ""}
    ${lines(title.lines, { x, y: titleY, size: title.size, leading: 1.2, fill: titleInk, anchor, weight: 700 })}
    ${c.subtitle ? lines([c.subtitle], { x, y: subtitleY, size: 30, fill: c.style === "band" ? "#26221d" : softInk, anchor }) : ""}
    ${lines(authorLines, { x, y: authorY, size: 28, leading: 1.25, fill: bodyInk, anchor })}
    ${lines([book.publisher ?? ""], { x, y: BY + BH - 64, size: 26, fill: bodyInk, anchor })}`;

  return frame(desk, seed, bookBlock(face, { worn: book.condition === "fair" || book.condition === "poor" }));
}

// An open page with the seller's notes: highlighter, pencil underlines, margin notes.
function insideSvg(book, desk) {
  const seed = hash(`${book.title}-inside`);
  const lots = book.writing === "lots";
  const rows = [];
  let y = BY + 150;
  for (let i = 0; i < 17; i++, y += 38) {
    const width = i % 6 === 5 ? 180 + ((seed >> i) % 200) : 440 + ((seed >> i) % 50);
    rows.push({ y, width });
  }
  const text = rows.map((r) => `<rect x="${BX + 70}" y="${r.y}" width="${r.width}" height="12" rx="3" fill="#8b857b" fill-opacity="0.55"/>`).join("");
  const marks = (lots ? [1, 3, 4, 7, 9, 12, 14] : [3, 9]).map((i) => {
    const r = rows[i];
    return `<rect x="${BX + 64}" y="${r.y - 9}" width="${Math.min(r.width, 300) + 12}" height="28" fill="#f6dd3c" fill-opacity="0.5"/>`;
  });
  const underline = (lots ? [5, 10, 15] : [12]).map((i) => {
    const r = rows[i];
    return `<path d="M${BX + 70} ${r.y + 20} q ${r.width / 4} 5 ${r.width / 2} 0 t ${r.width / 2} 0" stroke="${lots ? "#c8423b" : "#55524c"}" stroke-width="3" fill="none"/>`;
  });
  const notes = lots
    ? `<path d="M${BX + 540} ${BY + 260} c 10 -14 26 -14 30 0 s 18 14 28 -2 M${BX + 536} ${BY + 296} c 14 -10 22 6 34 -4" stroke="#c8423b" stroke-width="3" fill="none"/>
       <path d="M${BX + 528} ${BY + 560} c 20 -18 40 10 58 -6 M${BX + 532} ${BY + 594} c 12 -8 24 8 40 -2" stroke="#3b5bc8" stroke-width="3" fill="none"/>
       <circle cx="${BX + 330}" cy="${BY + 700}" r="34" stroke="#c8423b" stroke-width="3" fill="none"/>`
    : `<path d="M${BX + 540} ${BY + 500} c 10 -12 24 -10 30 2 s 16 10 26 -4" stroke="#55524c" stroke-width="2.5" fill="none"/>`;
  const page = `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="3" fill="#fbf8f1"/>
    <rect x="${BX + 70}" y="${BY + 80}" width="220" height="22" rx="4" fill="#3f3b35" fill-opacity="0.75"/>
    ${marks.join("")}${text}${underline.join("")}${notes}
    <text x="${BX + BW / 2}" y="${BY + BH - 40}" font-size="22" fill="#8b857b" text-anchor="middle" font-family="${FONT}">${40 + (seed % 160)}</text>`;
  return frame(desk, seed, bookBlock(page));
}

// Back cover with an EAN barcode and the printed list price.
function backSvg(book, desk) {
  const seed = hash(`${book.title}-back`);
  const c = book.cover;
  const isbn = book.isbn;
  const base = Math.round(book.listPrice / 1.1);
  const bars = [];
  let x = 0;
  for (let i = 0; i < 64; i++) {
    const wBar = 2 + ((Number(isbn[i % 13]) + i * 7) % 3) * 2;
    if (i % 2 === 0) bars.push(`<rect x="${BX + 330 + x}" y="${BY + 120}" width="${wBar}" height="120" fill="#111"/>`);
    x += wBar + 1;
    if (x > 200) break;
  }
  const label = `ISBN ${isbn}`;
  const back = `<rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="4" fill="${c.style === "band" ? "#f3efe6" : c.color}"/>
    <rect x="${BX + 300}" y="${BY + 90}" width="260" height="260" fill="#fff"/>
    ${bars.join("")}
    <text x="${BX + 316}" y="${BY + 285}" font-size="17" fill="#111" font-family="${FONT}">${label}</text>
    <text x="${BX + 316}" y="${BY + 318}" font-size="19" fill="#111" font-family="${FONT}">定価（本体${base.toLocaleString("ja-JP")}円＋税）</text>
    <text x="${BX + 56}" y="${BY + BH - 70}" font-size="26" fill="${c.style === "band" ? "#5d564c" : "rgba(255,255,255,0.82)"}" font-family="${FONT}">${esc(book.publisher ?? "")}</text>`;
  return frame(desk, seed, bookBlock(back));
}

const RENDER = { cover: coverSvg, inside: insideSvg, back: backSvg };

/** Renders one listing photo as { full, thumb } WebP buffers (900×1200 and 360×480). */
export async function renderPhoto(kind, book, desk) {
  const svg = Buffer.from(RENDER[kind](book, desk));
  const full = await sharp(svg).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(svg).resize(360, 480).webp({ quality: 74 }).toBuffer();
  return { full, thumb, width: W, height: H };
}
