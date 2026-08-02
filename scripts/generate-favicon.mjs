/**
 * Regenerate favicon / PWA icons from public/icon-master.png
 * Usage: node scripts/generate-favicon.mjs
 */
import sharp from '../apps/api/node_modules/sharp/lib/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MASTER = path.join(ROOT, 'public', 'icon-master.png');
const OUT_DIR = path.join(ROOT, 'public');
const ICONS = path.join(OUT_DIR, 'icons');
const MOBILE = path.join(ROOT, 'apps', 'mobile', 'assets');
const CRIMSON = { r: 139, g: 26, b: 26, alpha: 1 };

function isBackgroundBlack(r, g, b) {
  return r <= 18 && g <= 12 && b <= 12 && r + g + b <= 36;
}

function floodKnockoutCorners(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundBlack(data[i], data[i + 1], data[i + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };
  push(0, 0);
  push(width - 1, 0);
  push(0, height - 1);
  push(width - 1, height - 1);
  while (queue.length) {
    const idx = queue.pop();
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function applyRoundedMask(data, width, height, radiusRatio = 0.175) {
  const radius = Math.round(Math.min(width, height) * radiusRatio);
  const cx0 = radius;
  const cy0 = radius;
  const cx1 = width - 1 - radius;
  const cy1 = height - 1 - radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let inside = true;
      if (x < cx0 && y < cy0) {
        const dx = x - cx0;
        const dy = y - cy0;
        inside = dx * dx + dy * dy <= radius * radius;
      } else if (x > cx1 && y < cy0) {
        const dx = x - cx1;
        const dy = y - cy0;
        inside = dx * dx + dy * dy <= radius * radius;
      } else if (x < cx0 && y > cy1) {
        const dx = x - cx0;
        const dy = y - cy1;
        inside = dx * dx + dy * dy <= radius * radius;
      } else if (x > cx1 && y > cy1) {
        const dx = x - cx1;
        const dy = y - cy1;
        inside = dx * dx + dy * dy <= radius * radius;
      }
      if (!inside) data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

async function ensureTransparentMaster() {
  const { data, info } = await sharp(MASTER)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  floodKnockoutCorners(rgba, info.width, info.height);
  applyRoundedMask(rgba, info.width, info.height, 0.175);
  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function writeIco(pngBuffers, outPath) {
  const count = pngBuffers.length;
  let offset = 6 + count * 16;
  const entries = [];
  for (const buf of pngBuffers) {
    const size = buf.readUInt32BE(16);
    entries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      bytes: buf.length,
      offset,
      buf,
    });
    offset += buf.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  let eOff = 6;
  for (const e of entries) {
    out[eOff] = e.width;
    out[eOff + 1] = e.height;
    out[eOff + 2] = 0;
    out[eOff + 3] = 0;
    out.writeUInt16LE(1, eOff + 4);
    out.writeUInt16LE(32, eOff + 6);
    out.writeUInt32LE(e.bytes, eOff + 8);
    out.writeUInt32LE(e.offset, eOff + 12);
    e.buf.copy(out, e.offset);
    eOff += 16;
  }
  fs.writeFileSync(outPath, out);
}

async function resizeTransparent(masterBuf, size) {
  return sharp(masterBuf)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(MASTER)) {
    console.error('Missing', MASTER);
    process.exit(1);
  }
  fs.mkdirSync(ICONS, { recursive: true });

  const masterBuf = await ensureTransparentMaster();
  fs.writeFileSync(MASTER, masterBuf);
  console.log('updated icon-master.png (transparent corners)');

  const transparent = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'favicon-48.png': 48,
    'icon-192.png': 192,
    'icon-512.png': 512,
  };
  for (const [name, size] of Object.entries(transparent)) {
    fs.writeFileSync(path.join(ICONS, name), await resizeTransparent(masterBuf, size));
    console.log('wrote', name);
  }

  const apple = await resizeTransparent(masterBuf, 180);
  await sharp({
    create: { width: 180, height: 180, channels: 4, background: CRIMSON },
  })
    .composite([{ input: apple, gravity: 'centre' }])
    .png()
    .toFile(path.join(ICONS, 'apple-touch-icon.png'));
  console.log('wrote apple-touch-icon.png');

  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.8);
    const icon = await resizeTransparent(masterBuf, inner);
    await sharp({
      create: { width: size, height: size, channels: 4, background: CRIMSON },
    })
      .composite([{ input: icon, gravity: 'centre' }])
      .png()
      .toFile(path.join(ICONS, `icon-maskable-${size}.png`));
    console.log(`wrote icon-maskable-${size}.png`);
  }

  const icoPngs = [];
  for (const s of [16, 32, 48]) {
    icoPngs.push(await resizeTransparent(masterBuf, s));
  }
  writeIco(icoPngs, path.join(OUT_DIR, 'favicon.ico'));
  console.log('wrote favicon.ico');

  // Expo mobile assets (same brand; no leftover default Expo chevron)
  if (fs.existsSync(MOBILE)) {
    fs.writeFileSync(path.join(MOBILE, 'favicon.png'), await resizeTransparent(masterBuf, 48));
    fs.writeFileSync(path.join(MOBILE, 'icon.png'), await resizeTransparent(masterBuf, 1024));
    const splash = await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: CRIMSON },
    })
      .composite([{ input: await resizeTransparent(masterBuf, 512), gravity: 'centre' }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(MOBILE, 'splash-icon.png'), splash);

    const fg = await resizeTransparent(masterBuf, 432);
    await sharp({
      create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: fg, gravity: 'centre' }])
      .png()
      .toFile(path.join(MOBILE, 'android-icon-foreground.png'));
    await sharp({
      create: { width: 432, height: 432, channels: 4, background: CRIMSON },
    })
      .png()
      .toFile(path.join(MOBILE, 'android-icon-background.png'));
    // Simple monochrome silhouette for Android themed icon
    await sharp(masterBuf)
      .resize(432, 432, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .greyscale()
      .threshold(40)
      .png()
      .toFile(path.join(MOBILE, 'android-icon-monochrome.png'));
    console.log('updated apps/mobile/assets/*');
  }

  // Remove known duplicates / obsolete names
  for (const obsolete of [
    path.join(ICONS, 'favicon-32.png'),
    path.join(ICONS, 'favicon.ico'),
  ]) {
    if (fs.existsSync(obsolete)) {
      fs.unlinkSync(obsolete);
      console.log('removed', path.relative(ROOT, obsolete));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
