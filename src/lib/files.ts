const PDF = [0x25, 0x50, 0x44, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 5;

export type DetectedFile = {
  contentType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  extension: "pdf" | "png" | "jpg" | "webp";
};

export function detectFile(bytes: Uint8Array): DetectedFile | null {
  if (bytes.length < 12) return null;
  if (PDF.every((byte, index) => bytes[index] === byte)) {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (PNG.every((byte, index) => bytes[index] === byte)) {
    return { contentType: "image/png", extension: "png" };
  }
  if (JPEG.every((byte, index) => bytes[index] === byte)) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ()\u4e00-\u9fff]/g, "").slice(0, 120);
  return cleaned || "attachment";
}
