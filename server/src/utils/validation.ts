import type { ZodType, ZodTypeDef } from 'zod';
import { ApiError } from './ApiError.js';

/** Parses untrusted input with a zod schema, throwing a 400 ApiError with field errors. */
export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const first = result.error.issues[0];
    const message = first ? `${first.path.length ? first.path.join('.') + ': ' : ''}${first.message}` : 'Invalid input';
    throw ApiError.badRequest(message, { fieldErrors });
  }
  return result.data;
}
