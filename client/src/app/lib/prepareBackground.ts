/** Decode/re-encode uploads, stripping metadata and fitting a small DB budget. */
export async function prepareBackground(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('This image could not be opened.'));
      img.src = url;
    });
    if (!image.width || !image.height || image.width * image.height > 40_000_000) throw new Error('Choose an image no larger than 40 megapixels.');
    const canvas = document.createElement('canvas');
    for (const width of [1200, 900, 600]) {
      canvas.width = width;
      canvas.height = width / 3;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image processing is not available in this browser.');
      const scale = Math.max(width / image.width, canvas.height / image.height);
      const w = image.width * scale, h = image.height * scale;
      ctx.drawImage(image, (width - w) / 2, (canvas.height - h) / 2, w, h);
      for (const quality of [0.85, 0.65, 0.45]) {
        const data = canvas.toDataURL('image/webp', quality);
        if (/^data:image\/(webp|png);base64,/.test(data) && data.length <= 150_000) return data;
      }
    }
    throw new Error('Image is too detailed to save. Please choose a smaller image.');
  } finally { URL.revokeObjectURL(url); }
}
