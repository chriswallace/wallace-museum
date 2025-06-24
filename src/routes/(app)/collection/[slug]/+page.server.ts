import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';

export const load: PageServerLoad = async ({ params }) => {
	const collectionSlug = params.slug;
	
	const collection = await prisma.collection.findUnique({
		where: { slug: collectionSlug },
		include: {
			Artwork: {
				where: {
					OR: [
						{ imageUrl: { not: null } },
						{ animationUrl: { not: null } }
					]
				},
				include: {
					Artist: {
						select: {
							id: true,
							name: true,
							avatarUrl: true
						}
					}
				},
				orderBy: [
					{ mintDate: 'asc' },
					{ id: 'asc' }
				]
			},
			Artist: {
				select: {
					id: true,
					name: true,
					avatarUrl: true
				}
			}
		}
	});

	if (!collection) {
		return { status: 404, error: 'Collection not found' };
	}

	// Transform artwork data to match expected format
	const artworks = collection.Artwork.map((artwork) => ({
		id: String(artwork.id),
		title: artwork.title,
		description: artwork.description,
		image_url: artwork.imageUrl,
		animation_url: artwork.animationUrl,
		generator_url: artwork.generatorUrl,
		thumbnail_url: artwork.thumbnailUrl,
		dimensions: artwork.dimensions,
		contractAddr: artwork.contractAddress,
		contractAlias: null,
		tokenStandard: artwork.tokenStandard,
		tokenID: artwork.tokenId,
		mintDate: artwork.mintDate,
		mime: artwork.mime,
		tags: null,
		attributes: artwork.attributes,
		supply: artwork.supply,
		artists: artwork.Artist
	}));

	// Get additional collection statistics
	const totalArtworks = await prisma.artwork.count({
		where: { collectionId: collection.id }
	});

	return {
		collection: {
			id: collection.id,
			title: collection.title,
			slug: collection.slug,
			description: collection.description,
			curatorNotes: collection.curatorNotes,
			imageUrl: collection.imageUrl,
			bannerImageUrl: collection.bannerImageUrl,
			websiteUrl: collection.websiteUrl,
			projectUrl: collection.projectUrl,
			discordUrl: collection.discordUrl,
			telegramUrl: collection.telegramUrl,
			mediumUrl: collection.mediumUrl,
			isGenerativeArt: collection.isGenerativeArt,
			isSharedContract: collection.isSharedContract,
			artBlocksProjectId: collection.artBlocksProjectId,
			fxhashProjectId: collection.fxhashProjectId,
			chainIdentifier: collection.chainIdentifier,
			contractAddresses: collection.contractAddresses,
			parentContract: collection.parentContract,
			projectNumber: collection.projectNumber,
			mintStartDate: collection.mintStartDate,
			mintEndDate: collection.mintEndDate,
			totalSupply: collection.totalSupply,
			currentSupply: collection.currentSupply,
			floorPrice: collection.floorPrice,
			volumeTraded: collection.volumeTraded,
			enabled: collection.enabled,
			lastSyncedAt: collection.lastSyncedAt,
			artworks,
			artists: collection.Artist,
			totalArtworks
		}
	};
}; 