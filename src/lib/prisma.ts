import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment'; // Import dev environment check from SvelteKit

// Extend PrismaClient to include any custom types needed
// This helps TypeScript recognize models that might not be in the generated types yet
class ExtendedPrismaClient extends PrismaClient {
	constructor() {
		super();
	}

	// Add settings model if it doesn't exist in generated types
	get settings() {
		return this._settings();
	}

	_settings() {
		return {
			findUnique: (args: any) =>
				this.$queryRaw`SELECT * FROM "Settings" WHERE key = ${args.where.key} LIMIT 1`,
			upsert: (args: any) => {
				const { where, update, create } = args;
				return this.$executeRaw`
					INSERT INTO "Settings" (key, value, "createdAt", "updatedAt") 
					VALUES (${create.key}, ${JSON.stringify(create.value)}, NOW(), NOW())
					ON CONFLICT (key) 
					DO UPDATE SET value = ${JSON.stringify(update.value)}, "updatedAt" = NOW()
					RETURNING *;
				`;
			},
			update: (args: any) => {
				const { where, data } = args;
				return this.$executeRaw`
					UPDATE "Settings" 
					SET value = ${JSON.stringify(data.value)}, "updatedAt" = NOW()
					WHERE key = ${where.key}
					RETURNING *;
				`;
			}
		};
	}

	// Add artworkIndex model if it doesn't exist in generated types
	get artworkIndex() {
		return this._artworkIndex();
	}

	_artworkIndex() {
		return {
			findUnique: (args: any) => {
				const { where } = args;
				if (where.id) {
					return this.$queryRaw`SELECT * FROM "ArtworkIndex" WHERE id = ${where.id} LIMIT 1`;
				} else if (where.artworkId) {
					return this
						.$queryRaw`SELECT * FROM "ArtworkIndex" WHERE "artworkId" = ${where.artworkId} LIMIT 1`;
				}
				return null;
			},
			create: (args: any) => {
				const { data } = args;
				return this.$executeRaw`
					INSERT INTO "ArtworkIndex" ("artworkId", "indexedData", "createdAt", "updatedAt") 
					VALUES (${data.artworkId}, ${JSON.stringify(data.indexedData)}, NOW(), NOW())
					RETURNING *;
				`;
			},
			update: (args: any) => {
				const { where, data } = args;
				if (where.id) {
					return this.$executeRaw`
						UPDATE "ArtworkIndex" 
						SET "indexedData" = ${JSON.stringify(data.indexedData)}, "updatedAt" = ${data.updatedAt || 'NOW()'}
						WHERE id = ${where.id}
						RETURNING *;
					`;
				} else if (where.artworkId) {
					return this.$executeRaw`
						UPDATE "ArtworkIndex" 
						SET "indexedData" = ${JSON.stringify(data.indexedData)}, "updatedAt" = ${data.updatedAt || 'NOW()'}
						WHERE "artworkId" = ${where.artworkId}
						RETURNING *;
					`;
				}
			},
			upsert: (args: any) => {
				// Use create if not exists, update if exists
				const { where, create, update } = args;
				return this.$executeRaw`
					INSERT INTO "ArtworkIndex" ("artworkId", "indexedData", "createdAt", "updatedAt") 
					VALUES (${create.artworkId}, ${JSON.stringify(create.indexedData)}, NOW(), NOW())
					ON CONFLICT (id) 
					DO UPDATE SET "indexedData" = ${JSON.stringify(update.indexedData)}, "updatedAt" = ${update.updatedAt || 'NOW()'}
					RETURNING *;
				`;
			},
			count: (args: any) => {
				// Simplified count query
				return this.$queryRaw`SELECT COUNT(*) FROM "ArtworkIndex"`.then((result: any) =>
					Number(result[0].count)
				);
			},
			findMany: (args: any) => {
				// Simplified findMany (doesn't implement all filtering logic)
				const { skip = 0, take = 100 } = args;
				return this.$queryRaw`
					SELECT * FROM "ArtworkIndex" 
					LIMIT ${take} OFFSET ${skip}
				`;
			}
		};
	}
}

// Use globalThis to store the client in development, preventing multiple instances due to hot-reloading
const prismaClientSingleton = () => {
	return new ExtendedPrismaClient();
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
