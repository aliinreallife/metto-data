import sharp from "sharp";

/** Decode and re-encode at the trust boundary; browser checks are only UX. */
export async function sanitizePhoto(base64: string): Promise<string> {
  const image = sharp(Buffer.from(base64, "base64"), {
    limitInputPixels: 2048 * 2048,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  if (metadata.format !== "jpeg") throw Error("invalid photo");
  // Sharp strips EXIF (including GPS), comments and other source metadata by
  // default. Never retain the original file, filename or an external URL.
  for (const quality of [85, 75, 65, 55]) {
    const bytes = await image
      .clone()
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    if (bytes.length <= 524288) return bytes.toString("base64");
  }
  throw Error("photo too large");
}
