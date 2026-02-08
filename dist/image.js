import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
const THUMBNAIL_SIZES = {
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
async function ensureDir(filePath) {
    await mkdir(dirname(filePath), { recursive: true });
}
export async function createFavicon(input, outputDir) {
    const resolvedDir = resolve(outputDir);
    await mkdir(resolvedDir, { recursive: true });
    const files = [];
    const image = sharp(input);
    for (const { name, size } of FAVICON_SIZES) {
        const outputPath = join(resolvedDir, name);
        await image.clone().resize(size, size, { fit: 'cover' }).png().toFile(outputPath);
        files.push(outputPath);
    }
    // Create favicon.ico with multiple sizes (16, 32, 48)
    const icoPath = join(resolvedDir, 'favicon.ico');
    const sizes = [16, 32, 48];
    const buffers = await Promise.all(sizes.map((size) => image.clone().resize(size, size, { fit: 'cover' }).png().toBuffer()));
    // ICO format: simple approach - use largest PNG as ICO
    // For true multi-size ICO, we'd need a dedicated library
    // Sharp doesn't support ICO output, so we'll use the 32x32 PNG
    await image.clone().resize(32, 32, { fit: 'cover' }).png().toFile(icoPath);
    files.push(icoPath);
    return { files, outputDir: resolvedDir };
}
export async function convert(input, output, format) {
    const resolvedOutput = resolve(output);
    await ensureDir(resolvedOutput);
    const image = sharp(input);
    let result;
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
export async function resize(input, output, width, height, fit = 'cover') {
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
export async function crop(input, output, left, top, width, height) {
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
export async function compress(input, output, quality = 80) {
    const resolvedOutput = resolve(output);
    await ensureDir(resolvedOutput);
    const image = sharp(input);
    const metadata = await image.metadata();
    const format = metadata.format;
    let result;
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
export async function thumbnail(input, output, size = 'medium') {
    const dimension = THUMBNAIL_SIZES[size];
    return resize(input, output, dimension, dimension, 'cover');
}
//# sourceMappingURL=image.js.map