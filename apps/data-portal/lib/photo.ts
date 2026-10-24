export async function preparePhoto(
  file: File | undefined,
): Promise<string | undefined> {
  if (!file?.size) return undefined;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("photoError");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas"),
      scale = Math.min(
        1,
        2048 / Math.max(image.naturalWidth, image.naturalHeight),
      );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error("photoError");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 524288) break;
    }
    if (!blob || blob.size > 524288) throw Error("photoError");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  } catch {
    throw Error("photoError");
  } finally {
    URL.revokeObjectURL(url);
  }
}
