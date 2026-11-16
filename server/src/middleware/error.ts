import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(ApiError.notFound('Endpoint not found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 5 MB or smaller'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files uploaded'
          : err.message;
    res.status(400).json({ error: { message, code: 'UPLOAD_ERROR' } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'This record already exists', code: 'CONFLICT' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      return;
    }
  }

  // Malformed JSON bodies
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Malformed JSON body', code: 'BAD_REQUEST' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { message: isProduction ? 'Something went wrong' : String(err?.message ?? err), code: 'INTERNAL' },
  });
};
