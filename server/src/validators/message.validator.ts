import { z } from 'zod';
import { idSchema } from './common.js';

export const messageContent = z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long');

export const startConversationSchema = z.object({
  recipientId: idSchema,
  listingId: idSchema.optional(),
  content: messageContent,
});

export const sendMessageSchema = z.object({ content: messageContent });
