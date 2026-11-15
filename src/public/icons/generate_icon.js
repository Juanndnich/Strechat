/**
 * Generates a valid 256x256 RGBA PNG icon using Node.js built-in zlib.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height) {
  // Generate RGBA pixel data
  const rowSize = width * 4 + 1; // +1 for filter byte (0)
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Gradient from #6366f1 (99, 102, 241) to #f43f5e (244, 63, 94)
        const t = (x + y) / (width + height);
        const red = Math.round(99 + t * (244 - 99));
        const green = Math.round(102 + t * (63 - 102));
        const blue = Math.round(241 + t * (94 - 241));

        // Draw inner chat bubble
        const inBubble = (x >= width * 0.28 && x <= width * 0.72 && y >= height * 0.32 && y <= height * 0.65);
        if (inBubble) {
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = red;
          rawData[pxOffset + 1] = green;
          rawData[pxOffset + 2] = blue;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);

    // Calculate CRC
    const crc = crc32(Buffer.concat([Buffer.from(type), data]));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  function crc32(buf) {
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ byte) & 1) {
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
        byte = byte >>> 1;
      }
    }
    return (crc ^ -1) >>> 0;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconBuf = createPng(256, 256);
fs.writeFileSync(path.join(__dirname, 'icon.png'), iconBuf);
console.log('icon.png generated successfully, size:', iconBuf.length, 'bytes');

// Generate multi-size icon.ico for Windows
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map(s => ({ size: s, buf: createPng(s, s) }));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // ICO
header.writeUInt16LE(images.length, 4); // count

const dirEntries = [];
let offset = 6 + (16 * images.length);

for (const img of images) {
  const entry = Buffer.alloc(16);
  entry[0] = img.size === 256 ? 0 : img.size; // width (0 = 256)
  entry[1] = img.size === 256 ? 0 : img.size; // height (0 = 256)
  entry[2] = 0; // color palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(img.buf.length, 8); // size
  entry.writeUInt32LE(offset, 12); // offset
  dirEntries.push(entry);
  offset += img.buf.length;
}

const icoBuffer = Buffer.concat([header, ...dirEntries, ...images.map(img => img.buf)]);
fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoBuffer);
console.log('icon.ico generated successfully, size:', icoBuffer.length, 'bytes');
