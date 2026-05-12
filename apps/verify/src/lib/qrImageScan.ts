import jsQR from "jsqr";
import { rawCertificateJsonFromQrPayload } from "./enrollmentQrPayload.ts";

export { rawCertificateJsonFromQrPayload };

export function readQrTextFromImageData(imageData: ImageData): string | null {
  const r = jsQR(imageData.data, imageData.width, imageData.height);
  return r?.data ?? null;
}

/**
 * Decode the first QR code found in a browser image file (PNG/JPEG/WebP).
 */
export async function readQrTextFromImageFile(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  try {
    const short = Math.min(bmp.width, bmp.height);
    const scales = [512, 768, 1024].map((target) => Math.max(1, Math.ceil(target / Math.max(1, short))));
    for (const scale of scales) {
      const w = bmp.width * scale;
      const h = bmp.height * scale;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx === null) {
        return null;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bmp, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const text = readQrTextFromImageData(data);
      if (text !== null) {
        return text;
      }
    }
    return null;
  } finally {
    bmp.close();
  }
}
