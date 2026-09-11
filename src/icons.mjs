import { deflateSync } from 'node:zlib';
import { crc32 } from './crc32.mjs';

export const ICON_SIZES = [16, 32, 48, 128];

const SAMPLES_PER_AXIS = 4;
const CORNER_RADIUS = 0.22;
const DISC_RADIUS = 0.34;
const SPINDLE_RADIUS = 0.1;

const PLATE = [0x1b, 0x1b, 0x1f, 0xff];
const TRANSPARENT = [0, 0, 0, 0];

export const ICON_VARIANTS = {
  icon: [0xff, 0x6b, 0x35, 0xff],
  off: [0x5a, 0x5a, 0x63, 0xff]
};

const insideRoundedSquare = (x, y) => {
  const dx = Math.max(CORNER_RADIUS - x, x - (1 - CORNER_RADIUS), 0);
  const dy = Math.max(CORNER_RADIUS - y, y - (1 - CORNER_RADIUS), 0);
  return dx * dx + dy * dy <= CORNER_RADIUS * CORNER_RADIUS;
};

const colourAt = (x, y, accent) => {
  if (!insideRoundedSquare(x, y)) return TRANSPARENT;
  const distance = Math.hypot(x - 0.5, y - 0.5);
  if (distance <= SPINDLE_RADIUS || distance > DISC_RADIUS) return PLATE;
  return accent;
};

const samplePixel = (column, row, size, accent) => {
  const step = 1 / (size * SAMPLES_PER_AXIS);
  let red = 0;
  let green = 0;
  let blue = 0;
  let coverage = 0;
  for (let sampleY = 0; sampleY < SAMPLES_PER_AXIS; sampleY += 1) {
    for (let sampleX = 0; sampleX < SAMPLES_PER_AXIS; sampleX += 1) {
      const x = (column * SAMPLES_PER_AXIS + sampleX + 0.5) * step;
      const y = (row * SAMPLES_PER_AXIS + sampleY + 0.5) * step;
      const [r, g, b, a] = colourAt(x, y, accent);
      const weight = a / 255;
      red += r * weight;
      green += g * weight;
      blue += b * weight;
      coverage += weight;
    }
  }
  if (coverage === 0) return TRANSPARENT;
  const samples = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS;
  return [
    Math.round(red / coverage),
    Math.round(green / coverage),
    Math.round(blue / coverage),
    Math.round((coverage / samples) * 255)
  ];
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
};

const encodePng = (size, pixels) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let row = 0; row < size; row += 1) {
    const offset = row * (stride + 1);
    raw[offset] = 0;
    pixels.copy(raw, offset + 1, row * stride, (row + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

export const renderIcon = (size, variant = 'icon') => {
  const accent = ICON_VARIANTS[variant];
  const pixels = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      pixels.set(samplePixel(column, row, size, accent), (row * size + column) * 4);
    }
  }
  return encodePng(size, pixels);
};
