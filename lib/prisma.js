import { PrismaClient } from '@prisma/client';

const globalForPrisma = typeof global !== 'undefined' ? global : {};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({       
    log: ['query'],         
  });

if (process.env.NODE_ENV !== 'production' && typeof global !== 'undefined') {
  globalForPrisma.prisma = prisma;
}