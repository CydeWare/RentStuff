import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_UPLOAD = 8;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Files are buffered in memory (bounded by size/count limits) so that their real
 * content can be verified before anything is written to storage.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_UPLOAD, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(ApiError.badRequest('Only JPEG, PNG and WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});
