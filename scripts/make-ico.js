const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');

(async () => {
  const sizes = [16, 32, 48, 64, 128, 256];
  const srcPng = path.join(ROOT, 'assets/icons/icon128.png');

  const images = await Promise.all(
    sizes.map(s => sharp(srcPng).resize(s, s, { fit: 'contain' }).png().toBuffer())
  );

  const HEADER = 6 + 16 * sizes.length;
  let offset = HEADER;
  const dir = Buffer.alloc(HEADER);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(sizes.length, 4);

  sizes.forEach((s, i) => {
    const img = images[i];
    const off = 6 + 16 * i;
    dir.writeUInt8(s === 256 ? 0 : s, off + 0);
    dir.writeUInt8(s === 256 ? 0 : s, off + 1);
    dir.writeUInt8(0, off + 2);
    dir.writeUInt8(0, off + 3);
    dir.writeUInt16LE(1, off + 4);
    dir.writeUInt16LE(32, off + 6);
    dir.writeUInt32LE(img.length, off + 8);
    dir.writeUInt32LE(offset, off + 12);
    offset += img.length;
  });

  const out = Buffer.concat([dir, ...images]);
  fs.writeFileSync(path.join(ROOT, 'assets/icons/icon.ico'), out);
  console.log('icon.ico created:', out.length, 'bytes,', sizes.length, 'sizes');
})();
