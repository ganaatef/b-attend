import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildPrismaOptions() {
  const options: any = {
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  }

  if (process.env.NODE_ENV === 'production') {
    const baseUrl = process.env.DATABASE_URL ?? ''
    options.datasourceUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=10&pool_timeout=10`
  }

  return options
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(buildPrismaOptions())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db