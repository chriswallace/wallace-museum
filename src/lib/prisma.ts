import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment'; // Import dev environment check from SvelteKit

// Use globalThis to store the client in development, preventing multiple instances due to hot-reloading
const prismaClientSingleton = () => {
	return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (dev) {
	globalForPrisma.prisma = prisma;
}
