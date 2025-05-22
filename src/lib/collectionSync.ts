import { PrismaClient, Prisma, Collection } from '@prisma/client';
import { fetchCollection as fetchObjktCollection } from './objktHelpers';
import { fetchCollection as fetchOpenSeaCollection } from './openseaHelpers';

const prisma = new PrismaClient();

interface CollectionData {
	slug: string;
	title: string;
	description?: string | null;
	chainIdentifier?: string | null;
	contractAddresses?: Prisma.InputJsonValue;
	fees?: Prisma.InputJsonValue;
	safelistStatus?: string | null;
	websiteUrl?: string | null;
	discordUrl?: string | null;
	telegramUrl?: string | null;
	mediumUrl?: string | null;
	projectUrl?: string | null;
	imageUrl?: string | null;
	bannerImageUrl?: string | null;
	enabled: boolean;
}

export async function syncCollection(
	identifier: string,
	platform: 'opensea' | 'objkt'
): Promise<Collection> {
	try {
		let collectionData: CollectionData;

		if (platform === 'opensea') {
			const data = await fetchOpenSeaCollection(identifier);

			// Extract the contract address to use as the slug for database storage
			// This ensures we're storing the actual contract address
			let contract = '';
			if (data.contracts && data.contracts.length > 0) {
				contract = data.contracts[0].address;
			} else if (identifier.startsWith('0x')) {
				contract = identifier; // If we don't have contracts data but identifier looks like a contract, use it
			} else {
				contract = data.collection || identifier; // Fallback to collection slug if no contract address is available
			}

			collectionData = {
				slug: contract, // Use the contract address as the slug
				title: data.name,
				description: data.description,
				chainIdentifier: data.contracts?.[0]?.chain || 'ethereum',
				contractAddresses: data.contracts as unknown as Prisma.InputJsonValue,
				fees: data.fees as unknown as Prisma.InputJsonValue,
				safelistStatus: data.safelist_status,
				discordUrl: data.discord_url,
				telegramUrl: data.telegram_url,
				projectUrl: data.project_url,
				imageUrl: data.image_url,
				bannerImageUrl: data.banner_image_url,
				enabled: true
			};
		} else {
			const data = await fetchObjktCollection(identifier);
			const collectionInfo = data.data.fa[0];

			collectionData = {
				slug: collectionInfo.contract,
				title: collectionInfo.name,
				description: collectionInfo.description,
				chainIdentifier: 'tezos',
				contractAddresses: [
					{ address: collectionInfo.contract, chain: 'tezos' }
				] as unknown as Prisma.InputJsonValue,
				websiteUrl: collectionInfo.website,
				projectUrl: collectionInfo.website,
				// Convert social links to our format
				discordUrl: collectionInfo.discord || null,
				telegramUrl: null, // Objkt doesn't provide telegram
				mediumUrl: null, // Objkt doesn't provide medium
				imageUrl: collectionInfo.logo || null,
				enabled: true
			};
		}

		// Update or create collection in database
		const updatedCollection = await prisma.collection.upsert({
			where: { slug: collectionData.slug },
			create: collectionData,
			update: collectionData
		});

		return updatedCollection;
	} catch (error) {
		console.error(`Error syncing ${platform} collection:`, error);
		throw error;
	}
}

export async function syncCollections(
	identifiers: string[],
	platform: 'opensea' | 'objkt'
): Promise<{
	succeeded: number;
	failed: number;
	total: number;
}> {
	const results = await Promise.allSettled(identifiers.map((id) => syncCollection(id, platform)));

	const succeeded = results.filter(
		(result): result is PromiseFulfilledResult<Collection> => result.status === 'fulfilled'
	).length;

	const failed = results.filter((result) => result.status === 'rejected').length;

	return {
		succeeded,
		failed,
		total: identifiers.length
	};
}
