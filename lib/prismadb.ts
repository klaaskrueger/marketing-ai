import { PrismaClient } from "@prisma/client";

//Making sure Just one Prisma instance is running
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prismadb =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismadb;
