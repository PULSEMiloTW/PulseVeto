import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ||= 'file:../storage/database/map-veto.db';
export const prisma = new PrismaClient();

export async function connectDatabase() {
  await prisma.$connect();
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
}
