export async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const size = 512;
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.85
    );
  });
}

export async function compressImage(blob, maxSizeKB = 200) {
  let quality = 0.85;
  let compressedBlob = blob;

  while (compressedBlob.size > maxSizeKB * 1024 && quality > 0.1) {
    const image = await createImage(URL.createObjectURL(blob));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = 512;
    canvas.height = 512;
    
    ctx.drawImage(image, 0, 0, 512, 512);

    compressedBlob = await new Promise((resolve) => {
      canvas.toBlob(
        (result) => {
          resolve(result || blob);
        },
        'image/jpeg',
        quality
      );
    });

    quality -= 0.1;
  }

  return compressedBlob;
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

export function blobToFile(blob, fileName) {
  return new File([blob], fileName, { type: blob.type });
}
