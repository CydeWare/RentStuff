import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      role: Role;
      name: string;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
