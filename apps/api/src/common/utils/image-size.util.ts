/**
 * 纯 JS 解析常见图片格式尺寸（PNG / GIF / JPEG / WebP），不引入原生依赖。
 * 解析失败返回 null，调用方（媒体库）将宽高置空，不影响上传流程。
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** 允许的宽高范围：超出视为解析不可信（畸形头/溢出），直接置空 */
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 10_000;

function sanitizeDimension(value: number): number | null {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  if (value < MIN_DIMENSION || value > MAX_DIMENSION) return null;
  return value;
}

export function readImageDimensions(buffer: Buffer): ImageDimensions | null {
  if (!buffer || buffer.length < 16) return null;
  try {
    const raw = png(buffer) ?? gif(buffer) ?? webp(buffer) ?? jpeg(buffer);
    if (!raw) return null;
    // PNG 的 readUInt32BE 最大可到 4294967295，远超 Prisma Int(32 位有符号)；
    // 越界一律置 null，避免写库抛错 + 文件已落盘产生孤儿文件
    const width = sanitizeDimension(raw.width);
    const height = sanitizeDimension(raw.height);
    if (width === null || height === null) return null;
    return { width, height };
  } catch {
    return null;
  }
}

function png(buf: Buffer): ImageDimensions | null {
  const signature = buf.subarray(0, 8);
  if (signature.toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gif(buf: Buffer): ImageDimensions | null {
  const header = buf.subarray(0, 6).toString('ascii');
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function webp(buf: Buffer): ImageDimensions | null {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const format = buf.toString('ascii', 12, 16);
  if (format === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (format === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (format === 'VP8X') {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
}

function jpeg(buf: Buffer): ImageDimensions | null {
  if (buf.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}
