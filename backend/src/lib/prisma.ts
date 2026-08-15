import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma';
import { env } from '../config/env';

const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL.replace(/^file:/, '') });

export const prisma = new PrismaClient({ adapter });
