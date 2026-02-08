export type FitType = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
export type FormatType = 'png' | 'jpeg' | 'webp' | 'avif';
export type ThumbnailSize = 'small' | 'medium' | 'large';
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
export declare function createFavicon(input: string, outputDir: string): Promise<FaviconResult>;
export declare function convert(input: string, output: string, format: FormatType): Promise<ImageResult>;
export declare function resize(input: string, output: string, width: number, height?: number, fit?: FitType): Promise<ImageResult>;
export declare function crop(input: string, output: string, left: number, top: number, width: number, height: number): Promise<ImageResult>;
export declare function compress(input: string, output: string, quality?: number): Promise<ImageResult>;
export declare function thumbnail(input: string, output: string, size?: ThumbnailSize): Promise<ImageResult>;
//# sourceMappingURL=image.d.ts.map