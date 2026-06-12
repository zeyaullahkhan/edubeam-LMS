import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance for the whole monorepo.
export const prisma = new PrismaClient();
