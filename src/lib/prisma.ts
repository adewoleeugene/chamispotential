// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaLibSql } = require('@prisma/adapter-libsql');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pathModule = require('path');

type PrismaClientType = InstanceType<typeof import('@prisma/client').PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

function resolveDbUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    // Convert file:./prisma/dev.db → absolute file:// URL
    const p = envUrl.replace(/^file:/, '');
    const abs = pathModule.isAbsolute(p) ? p : pathModule.join(process.cwd(), p);
    return `file://${abs}`;
  }
  return `file://${pathModule.join(process.cwd(), 'prisma/dev.db')}`;
}

function createPrismaClient(): PrismaClientType {
  const url = resolveDbUrl();
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClientType =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
