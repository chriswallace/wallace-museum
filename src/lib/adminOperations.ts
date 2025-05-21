import prisma from '$lib/prisma';

// Define interfaces for expected data structures
interface SocialMediaAccounts {
	twitter?: string;    // Optional properties
	instagram?: string; // Optional properties
}

interface ArtistInfo {
	username?: string;   // Optional as address can be fallback
	address: string;
	bio?: string;
	avatarUrl?: string;
	website?: string;
	social_media_accounts?: SocialMediaAccounts; // Use the nested interface
}

interface CollectionInfo {
	contract: string;
	name?: string;
	description?: string;
	curatorNotes?: string;
	total_supply?: number; // Added based on saveArtwork usage
	blockchain?: string;  // Added based on saveArtwork usage
}

interface NftMetadata {
	image_url?: string;
	animation_url?: string;
	attributes?: any[]; // Keep attributes flexible for now
	symbol?: string;
}

interface NftInfo {
	tokenID: string | number; // Can be string or number
	name?: string;
	description?: string;
	collection: CollectionInfo; // Use CollectionInfo interface
	metadata: NftMetadata;    // Use NftMetadata interface
	mime?: string;
	token_standard?: string;
	updated_at: string | Date; // Can be string or Date
	dimensions?: { width?: number; height?: number };
}

export async function processArtist(artistInfo: ArtistInfo) {
	// Add checks for social_media_accounts and its properties
	const twitterHandle = artistInfo.social_media_accounts?.twitter ?? '';
	const instagramHandle = artistInfo.social_media_accounts?.instagram ?? '';

	return await prisma.artist.upsert({
		where: { name: artistInfo.username || artistInfo.address },
		update: {
			bio: artistInfo.bio,
			avatarUrl: artistInfo.avatarUrl,
			websiteUrl: artistInfo.website,
			twitterHandle: twitterHandle,
			instagramHandle: instagramHandle
		},
		create: {
			name: artistInfo.username || artistInfo.address,
			avatarUrl: artistInfo.avatarUrl,
			bio: artistInfo.bio,
			websiteUrl: artistInfo.website,
			twitterHandle: twitterHandle,
			instagramHandle: instagramHandle
		}
	});
}

export async function processCollection(collectionInfo: CollectionInfo) {
	//console.log('[processCollection] Received collectionInfo:', JSON.stringify(collectionInfo));
	const upsertParams = {
		where: { slug: collectionInfo.contract },
		update: {
			title: collectionInfo.name ?? '',
			description: collectionInfo.description ?? '',
			enabled: true,
			curatorNotes: collectionInfo.curatorNotes ?? ''
		},
		create: {
			slug: collectionInfo.contract,
			title: collectionInfo.name ?? '',
			description: collectionInfo.description ?? '',
			enabled: true,
			curatorNotes: collectionInfo.curatorNotes ?? ''
		}
	};
	//console.log('[processCollection] Upsert params:', JSON.stringify(upsertParams));
	return await prisma.collection.upsert(upsertParams);
}

export async function saveArtwork(nft: NftInfo, artistId: number, collectionId: number) {
	//console.log("Saving artwork", nft);

	// Ensure attributes is treated as JSON, default to empty array if null/undefined
	const attributes = nft.metadata.attributes || [];
	
	// Log the attributes for debugging
	console.log(`[SAVE_ARTWORK] Token: ${nft.tokenID} - Attributes:`, JSON.stringify(attributes));

	// Ensure dimensions is treated as JSON, default to empty object if null/undefined
	const dimensions = JSON.stringify(nft.dimensions || {});

	const uniqueWhere = {
		tokenID_contractAddr: {
			tokenID: String(nft.tokenID),
			contractAddr: nft.collection.contract
		}
	};

	// Ensure required string fields have default values for Prisma
	const artworkData = {
		title: nft.name ?? '',
		description: nft.description ?? '',
		image_url: nft.metadata.image_url ?? '',
		animation_url: nft.metadata.animation_url ?? '',
		attributes: attributes, // Prisma should handle JSON conversion for JSONB fields
		blockchain: nft.collection.blockchain ?? '',
		dimensions: dimensions,
		contractAddr: nft.collection.contract,
		contractAlias: nft.collection.name ?? '',
		mime: nft.mime ?? '',
		totalSupply: nft.collection.total_supply,
		symbol: nft.metadata.symbol ?? '',
		tokenStandard: nft.token_standard ?? '',
		tokenID: String(nft.tokenID),
		mintDate: new Date(nft.updated_at),
		collectionId: collectionId
		// Artist relation is handled via ArtistArtworks, not here
	};

	const existingArtwork = await prisma.artwork.findUnique({
		where: uniqueWhere
	});

	if (existingArtwork) {
		// Artwork exists, update it
		return await prisma.artwork.update({
			where: uniqueWhere,
			data: artworkData
			// Note: This update logic doesn't currently handle updating artist associations.
			// If an existing artwork needs its artists changed, separate logic is needed.
		});
	} else {
		// Artwork doesn't exist, create it
		return await prisma.artwork.create({
			data: {
				...artworkData,
				enabled: true,
				ArtistArtworks: {
					create: {
						artist: {
							connect: { id: artistId }
						}
					}
				}
			}
		});
	}
}
