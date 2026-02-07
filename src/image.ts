import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

export type FitType = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
export type FormatType = 'png' | 'jpeg' | 'webp' | 'avif';
export type ThumbnailSize = 'small' | 'medium' | 'large';

const THUMBNAIL_SIZES: Record<ThumbnailSize, number> = {
  small: 150,
  medium: 300,
  large: 600,
};

const FAVICON_SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

export interface FaviconResult {
  files: string[];
  outputDir: string;
}

export interface ImageResult {
  path: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function createFavicon(input: string, outputDir: string): Promise<FaviconResult> {
  const resolvedDir = resolve(outputDir);
  await mkdir(resolvedDir, { recursive: true });

  const files: string[] = [];
  const image = sharp(input);

  for (const { name, size } of FAVICON_SIZES) {
    const outputPath = join(resolvedDir, name);
    await image.clone().resize(size, size, { fit: 'cover' }).png().toFile(outputPath);
    files.push(outputPath);
  }

  // Create favicon.ico with multiple sizes (16, 32, 48)
  const icoPath = join(resolvedDir, 'favicon.ico');
  const sizes = [16, 32, 48];
  const buffers = await Promise.all(
    sizes.map((size) => image.clone().resize(size, size, { fit: 'cover' }).png().toBuffer())
  );

  // ICO format: simple approach - use largest PNG as ICO
  // For true multi-size ICO, we'd need a dedicated library
  // Sharp doesn't support ICO output, so we'll use the 32x32 PNG
  await image.clone().resize(32, 32, { fit: 'cover' }).png().toFile(icoPath);
  files.push(icoPath);

  return { files, outputDir: resolvedDir };
}

export async function convert(
  input: string,
  output: string,
  format: FormatType
): Promise<ImageResult> {
  const resolvedOutput = resolve(output);
  await ensureDir(resolvedOutput);

  const image = sharp(input);
  let result: sharp.Sharp;

  switch (format) {
    case 'png':
      result = image.png();
      break;
    case 'jpeg':
      result = image.jpeg();
      break;
    case 'webp':
      result = image.webp();
      break;
    case 'avif':
      result = image.avif();
      break;
  }

  const info = await result.toFile(resolvedOutput);

  return {
    path: resolvedOutput,
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
  };
}

export async function resize(
  input: string,
  output: string,
  width: number,
  height?: number,
  fit: FitType = 'cover'
): Promise<ImageResult> {
  const resolvedOutput = resolve(output);
  await ensureDir(resolvedOutput);

  const info = await sharp(input).resize(width, height, { fit }).toFile(resolvedOutput);

  return {
    path: resolvedOutput,
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
  };
}

export async function crop(
  input: string,
  output: string,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<ImageResult> {
  const resolvedOutput = resolve(output);
  await ensureDir(resolvedOutput);

  const info = await sharp(input).extract({ left, top, width, height }).toFile(resolvedOutput);

  return {
    path: resolvedOutput,
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
  };
}

export async function compress(input: string, output: string, quality = 80): Promise<ImageResult> {
  const resolvedOutput = resolve(output);
  await ensureDir(resolvedOutput);

  const image = sharp(input);
  const metadata = await image.metadata();
  const format = metadata.format;

  let result: sharp.Sharp;
  switch (format) {
    case 'png':
      result = image.png({ quality });
      break;
    case 'jpeg':
    case 'jpg':
      result = image.jpeg({ quality });
      break;
    case 'webp':
      result = image.webp({ quality });
      break;
    case 'avif':
      result = image.avif({ quality });
      break;
    default:
      // Default to PNG for unknown formats
      result = image.png({ quality });
  }

  const info = await result.toFile(resolvedOutput);

  return {
    path: resolvedOutput,
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
  };
}

export async function thumbnail(
  input: string,
  output: string,
  size: ThumbnailSize = 'medium'
): Promise<ImageResult> {
  const dimension = THUMBNAIL_SIZES[size];
  return resize(input, output, dimension, dimension, 'cover');
}
