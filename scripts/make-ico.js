const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PNG_PATH = path.join(__dirname, '..', 'resources', 'icon.png');
const ICO_PATH = path.join(__dirname, '..', 'resources', 'icon.ico');

async function main() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = [];

  for (const size of sizes) {
    const resized = await sharp(PNG_PATH)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = resized.data;
    const w = resized.info.width;
    const h = resized.info.height;

    // DIB header (BITMAPINFOHEADER) - 40 bytes
    const dibHeader = Buffer.alloc(40);
    dibHeader.writeInt32LE(40, 0);   // header size
    dibHeader.writeInt32LE(w, 4);    // width
    dibHeader.writeInt32LE(h * 2, 8); // height (XOR + AND)
    dibHeader.writeInt16LE(1, 12);   // planes
    dibHeader.writeInt16LE(32, 14);  // bits per pixel
    dibHeader.writeInt32LE(0, 16);   // compression (BI_RGB)
    dibHeader.writeInt32LE(0, 20);   // image size
    dibHeader.writeInt32LE(0, 24);   // x ppm
    dibHeader.writeInt32LE(0, 28);   // y ppm
    dibHeader.writeInt32LE(0, 32);   // colors used
    dibHeader.writeInt32LE(0, 36);   // important colors

    // XOR mask: BGRA, bottom-up, row-padded to 4 bytes
    const rowBytes = w * 4;
    const paddedRow = Math.ceil(rowBytes / 4) * 4;
    const xorMask = Buffer.alloc(paddedRow * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        const dstIdx = ((h - 1 - y) * paddedRow + x * 4);
        // RGBA -> BGRA
        xorMask[dstIdx] = rgba[srcIdx + 2];     // B
        xorMask[dstIdx + 1] = rgba[srcIdx + 1]; // G
        xorMask[dstIdx + 2] = rgba[srcIdx];     // R
        xorMask[dstIdx + 3] = 0xFF;             // A (force opaque for ICO)
      }
    }

    // AND mask: 1bpp, all zeros = fully opaque
    const andRowBytes = Math.ceil(w / 32) * 4;
    const andMask = Buffer.alloc(andRowBytes * h);

    // Combine
    const imageData = Buffer.concat([dibHeader, xorMask, andMask]);

    images.push({ size, data: imageData });
  }

  // Build ICO file
  const entrySize = 16;
  const dataOffset = 6 + entrySize * images.length;

  // Calculate offsets
  let currentOffset = dataOffset;
  const offsets = [];
  for (const img of images) {
    offsets.push(currentOffset);
    currentOffset += img.data.length;
  }

  const icoBuf = Buffer.alloc(currentOffset);

  // Header
  icoBuf.writeUInt16LE(0, 0);           // reserved
  icoBuf.writeUInt16LE(1, 2);           // type: icon
  icoBuf.writeUInt16LE(images.length, 4); // count

  // Entries + data
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const off = 6 + i * entrySize;
    icoBuf.writeUInt8(img.size >= 256 ? 0 : img.size, off);
    icoBuf.writeUInt8(img.size >= 256 ? 0 : img.size, off + 1);
    icoBuf.writeUInt8(0, off + 2);
    icoBuf.writeUInt8(0, off + 3);
    icoBuf.writeUInt16LE(1, off + 4);
    icoBuf.writeUInt16LE(32, off + 6);
    icoBuf.writeUInt32LE(img.data.length, off + 8);
    icoBuf.writeUInt32LE(offsets[i], off + 12);

    img.data.copy(icoBuf, offsets[i]);
  }

  fs.writeFileSync(ICO_PATH, icoBuf);
  console.log('ICO created: ' + ICO_PATH);
  console.log('Size: ' + icoBuf.length + ' bytes, ' + images.length + ' resolutions');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
