import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryEnabled, env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

type ImageKind = 'jpg' | 'png' | 'webp';

/** Detects the real image type from magic bytes; the client-provided MIME type is not trusted. */
export function detectImageType(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Hosts whose image URLs may be stored on listings / profiles. */
export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith('/uploads/') && /^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(url)) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return ['res.cloudinary.com', 'images.unsplash.com'].includes(u.hostname);
  } catch {
    return false;
  }
}

export async function storeImage(file: Express.Multer.File, folder: string): Promise<string> {
  const kind = detectImageType(file.buffer);
  if (!kind) throw ApiError.badRequest(`"${file.originalname}" is not a valid JPEG, PNG or WebP image`);

  if (cloudinaryEnabled) {
    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `rentora/${folder}`, resource_type: 'image' },
        (error, result) => {
          if (error || !result) reject(new ApiError(502, 'Image upload failed, please try again', 'UPLOAD_FAILED'));
          else resolve(result.secure_url);
        },
      );
      stream.end(file.buffer);
    });
  }

  // Development fallback: local disk. Filenames are random; original names are never used.
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${kind}`;
  await writeFile(path.join(UPLOAD_DIR, filename), file.buffer);
  return `/uploads/${filename}`;
}
