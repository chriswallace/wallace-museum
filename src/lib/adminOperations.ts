import prisma from '$lib/prisma';
import type { Artist, ArtistAddress, Collection } from '@prisma/client';

// Define interfaces for expected data structures
interface SocialMediaAccounts {
	twitter?: string; // Optional properties
	instagram?: string; // Optional properties
}

interface ArtistInfo {
	username?: string; // Optional as address can be fallback
	address: string;
	blockchain?: string; // Added to specify which blockchain the address belongs to
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
	blockchain?: string; // Added based on saveArtwork usage
}

interface NftMetadata {
	image_url?: string;
	animation_url?: string;
	attributes?: any[]; // Keep attributes flexible for now
	symbol?: string;
}

interface NftInfo {
	tokenID: string | number;
	name?: string;
	description?: string;
	collection: CollectionInfo;
	metadata: NftMetadata;
	mime?: string;
	token_standard?: string;
	updated_at: string | Date;
	dimensions?: { width?: number; height?: number };
	contractAlias?: string;
	symbol?: string;
	creator?: string; // Add creator field from OpenSea API
}

export async function processArtist(artistInfo: ArtistInfo) {
	const zeroAddress = '0x0000000000000000000000000000000000000000';
	let artistName = artistInfo.username;

	// Fallback to address if username is missing, empty, or zero address
	if (!artistName || artistName.trim() === '' || artistName === zeroAddress) {
		if (artistInfo.address && artistInfo.address !== zeroAddress) {
			artistName = artistInfo.address;
		} else {
			// If both username and address are invalid, cannot process artist
			console.warn('[ARTIST_PROCESS] Invalid artist name and address provided.');
			return null;
		}
	}

	const artistData = {
		name: artistName,
		bio: artistInfo.bio || '',
		websiteUrl: artistInfo.website || '',
		avatarUrl: artistInfo.avatarUrl || '',
		twitterHandle: artistInfo.social_media_accounts?.twitter || '',
		instagramHandle: artistInfo.social_media_accounts?.instagram || ''
	};

	let artist: (Artist & { addresses: ArtistAddress[] }) | null = null;

	// Try to find an existing artist by address first
	if (artistInfo.address && artistInfo.address !== zeroAddress) {
		const existingArtistAddress = await prisma.artistAddress.findUnique({
			where: {
				address_blockchain: {
					address: artistInfo.address,
					blockchain: artistInfo.blockchain || 'ethereum'
				}
			},
			include: {
				artist: {
					include: {
						addresses: true
					}
				}
			}
		});

		if (existingArtistAddress && existingArtistAddress.artist) {
			artist = existingArtistAddress.artist as Artist & { addresses: ArtistAddress[] };
			console.log('[ARTIST_PROCESS] Found existing artist by address:', artist.name);
			// Update existing artist if necessary (e.g. if username changed or new info available)
			// We only update if the current artist name is the address itself, implying it might be a placeholder
			if (artist.name === artistInfo.address && artistName !== artistInfo.address) {
				artist = (await prisma.artist.update({
					where: { id: artist.id },
					data: artistData,
					include: {
						addresses: true
					}
				})) as Artist & { addresses: ArtistAddress[] };
				console.log('[ARTIST_PROCESS] Updated artist with new name:', artist.name);
			}
			// Ensure the specific address is linked if it wasn't the one found (e.g. artist has multiple addresses)
			const addressExists = artist.addresses.find(
				(a: ArtistAddress) =>
					a.address === artistInfo.address && a.blockchain === (artistInfo.blockchain || 'ethereum')
			);
			if (!addressExists) {
				await prisma.artistAddress.create({
					data: {
						artistId: artist.id,
						address: artistInfo.address,
						blockchain: artistInfo.blockchain || 'ethereum'
					}
				});
				// Re-fetch artist to include the new address
				artist = (await prisma.artist.findUnique({
					where: { id: artist.id },
					include: { addresses: true }
				})) as Artist & { addresses: ArtistAddress[] };
			}
			return artist;
		}
	}

	// If no artist found by address, try to find by name
	// This is less reliable, so we only do this if no address was provided or no artist was found by address
	if (!artist) {
		const existingArtistByName = await prisma.artist.findUnique({
			where: { name: artistName },
			include: {
				addresses: true
			}
		});

		if (existingArtistByName) {
			artist = existingArtistByName as Artist & { addresses: ArtistAddress[] };
			console.log('[ARTIST_PROCESS] Found existing artist by name:', artist.name);
			// If an address is provided and not yet linked, link it
			if (artistInfo.address && artistInfo.address !== zeroAddress) {
				const addressExists = artist.addresses.find(
					(a: ArtistAddress) =>
						a.address === artistInfo.address &&
						a.blockchain === (artistInfo.blockchain || 'ethereum')
				);
				if (!addressExists) {
					await prisma.artistAddress.create({
						data: {
							artistId: artist.id,
							address: artistInfo.address,
							blockchain: artistInfo.blockchain || 'ethereum'
						}
					});
					// Re-fetch artist to include the new address
					artist = (await prisma.artist.findUnique({
						where: { id: artist.id },
						include: { addresses: true }
					})) as Artist & { addresses: ArtistAddress[] };
				}
			}
		}
	}

	// If still no artist, create a new one
	if (!artist) {
		// Only create new artist if we have valid information
		if (artistName && artistName !== zeroAddress) {
			console.log('[ARTIST_PROCESS] Creating new artist');
			try {
				artist = (await prisma.artist.create({
					data: {
						...artistData,
						addresses:
							artistInfo.address && artistInfo.address !== zeroAddress
								? {
										create: [
											{
												address: artistInfo.address,
												blockchain: artistInfo.blockchain || 'ethereum'
											}
										]
									}
								: undefined
					},
					include: {
						addresses: true
					}
				})) as Artist & { addresses: ArtistAddress[] };
			} catch (error: any) {
				if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
					// If name conflict, append part of the address or timestamp to make it unique
					console.log('[ARTIST_PROCESS] Name conflict detected, making name unique');
					const timestamp = Date.now().toString().slice(-6);
					artist = (await prisma.artist.create({
						data: {
							...artistData,
							name: `${artistName}_${timestamp}`,
							addresses:
								artistInfo.address && artistInfo.address !== zeroAddress
									? {
											create: [
												{
													address: artistInfo.address,
													blockchain: artistInfo.blockchain || 'ethereum'
												}
											]
										}
									: undefined
						},
						include: {
							addresses: true
						}
					})) as Artist & { addresses: ArtistAddress[] };
				} else {
					throw error;
				}
			}
		} else {
			return null; // Return null if we don't have valid artist information
		}
	}

	console.log('[ARTIST_PROCESS] Final artist record:', artist);
	return artist;
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

export async function saveArtwork(
	nft: NftInfo,
	artistId: number | null,
	collectionId: number | null
) {
	// Ensure attributes is treated as JSON, default to empty array if null/undefined
	const attributes = nft.metadata.attributes || [];

	//console.log(nft);

	// Validate that collection contract exists
	if (!nft.collection || !nft.collection.contract) {
		throw new Error(`Missing contract address for NFT ${nft.tokenID}`);
	}

	// Ensure dimensions has proper width and height values
	const normalizedDimensions =
		nft.dimensions &&
		typeof nft.dimensions.width === 'number' &&
		typeof nft.dimensions.height === 'number'
			? { width: nft.dimensions.width, height: nft.dimensions.height }
			: null;

	console.log(`Chris Dimensions:`, JSON.stringify(normalizedDimensions));

	// Convert to JSON for storage
	const dimensions = JSON.stringify(normalizedDimensions);

	// Upsert artwork: create if it doesn't exist, update if it does
	const artworkData = {
		title: nft.name || 'Untitled',
		description: nft.description || '',
		curatorNotes: '',
		enabled: true,
		dimensions: dimensions,
		collectionId: collectionId,
		contractAddr: nft.collection.contract,
		contractAlias: nft.collection.name || '',
		tokenID: String(nft.tokenID),
		blockchain: nft.collection.blockchain || 'ethereum',
		totalSupply: nft.collection.total_supply || null,
		tokenStandard: nft.token_standard || null,
		animation_url: nft.metadata.animation_url || null,
		image_url: nft.metadata.image_url || null,
		mime: nft.mime || null,
		symbol: nft.metadata.symbol || null,
		attributes: JSON.stringify(attributes),
		tags: JSON.stringify([])
	};

	const artwork = await prisma.artwork.upsert({
		where: {
			tokenID_contractAddr: {
				tokenID: String(nft.tokenID),
				contractAddr: nft.collection.contract
			}
		},
		update: artworkData,
		create: artworkData
	});

	// Create artist-artwork relationship only if artist ID is provided
	if (artistId !== null) {
		await prisma.artistArtworks.upsert({
			where: {
				artistId_artworkId: {
					artistId: artistId,
					artworkId: artwork.id
				}
			},
			update: {}, // No fields to update, just ensure it exists
			create: {
				artistId: artistId,
				artworkId: artwork.id
			}
		});
	}

	return artwork;
}
