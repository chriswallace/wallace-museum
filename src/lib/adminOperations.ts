import prisma from '$lib/prisma';

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
	// Add checks for social_media_accounts and its properties
	const twitterHandle = artistInfo.social_media_accounts?.twitter ?? '';
	const instagramHandle = artistInfo.social_media_accounts?.instagram ?? '';

	// Validate address - if no valid address and no username, return null
	const zeroAddress = '0x0000000000000000000000000000000000000000';
	if (!artistInfo.username && (!artistInfo.address || artistInfo.address === zeroAddress)) {
		console.log('[ARTIST_PROCESS] Invalid address and no username detected:', artistInfo.address);
		return null; // Return null instead of creating an unknown artist
	}

	// Use the provided username or address as the name, but sanitize it
	let artistName = artistInfo.username || artistInfo.address;

	// If we only have a zero address, return null
	if (artistName === zeroAddress) {
		return null;
	}

	console.log('[ARTIST_PROCESS] Looking for existing artist:', {
		name: artistName,
		address: artistInfo.address
	});

	// First try to find an artist by the desired name
	let artist = await prisma.artist.findFirst({
		where: {
			name: artistName
		},
		include: {
			addresses: true
		}
	});

	// If no artist found by name, look for one by address
	if (!artist && artistInfo.address && artistInfo.address !== zeroAddress) {
		artist = await prisma.artist.findFirst({
			where: {
				addresses: {
					some: {
						address: artistInfo.address
					}
				}
			},
			include: {
				addresses: true
			}
		});
	}

	console.log('[ARTIST_PROCESS] Found existing artist:', artist);

	// Prepare the update/create data
	const artistData = {
		bio: artistInfo.bio,
		avatarUrl: artistInfo.avatarUrl,
		websiteUrl: artistInfo.website,
		twitterHandle: twitterHandle,
		instagramHandle: instagramHandle
	};

	console.log('[ARTIST_PROCESS] Artist data to apply:', artistData);

	if (artist) {
		// Update existing artist - but don't try to update the name if it would cause a conflict
		console.log('[ARTIST_PROCESS] Updating existing artist with ID:', artist.id);
		try {
			// Only update name if current name is an address and we have a better name
			const shouldUpdateName = artist.name.startsWith('0x') && !artistName.startsWith('0x');

			artist = await prisma.artist.update({
				where: { id: artist.id },
				data: {
					...artistData,
					...(shouldUpdateName ? { name: artistName } : {})
				},
				include: {
					addresses: true
				}
			});

			// Add the address if it's new and valid
			if (artistInfo.address && artistInfo.address !== zeroAddress) {
				const existingAddress = artist.addresses.find((a) => a.address === artistInfo.address);
				if (!existingAddress) {
					await prisma.artistAddress.create({
						data: {
							address: artistInfo.address,
							blockchain: artistInfo.blockchain || 'ethereum',
							artistId: artist.id
						}
					});
				}
			}
		} catch (error: any) {
			if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
				// If name update fails, keep the original name
				console.log('[ARTIST_PROCESS] Name conflict detected, keeping original name');
				artist = await prisma.artist.update({
					where: { id: artist.id },
					data: artistData,
					include: {
						addresses: true
					}
				});
			} else {
				throw error;
			}
		}
	} else {
		// Only create new artist if we have valid information
		if (artistName && artistName !== zeroAddress) {
			console.log('[ARTIST_PROCESS] Creating new artist');
			try {
				artist = await prisma.artist.create({
					data: {
						...artistData,
						name: artistName,
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
				});
			} catch (error: any) {
				if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
					// If name conflict, append part of the address or timestamp to make it unique
					console.log('[ARTIST_PROCESS] Name conflict detected, making name unique');
					const timestamp = Date.now().toString().slice(-6);
					artist = await prisma.artist.create({
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
					});
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

export async function saveArtwork(nft: NftInfo, artistId: number, collectionId: number | null) {
	// Ensure attributes is treated as JSON, default to empty array if null/undefined
	const attributes = nft.metadata.attributes || [];

	// Log the attributes for debugging
	console.log(`[SAVE_ARTWORK] Token: ${nft.tokenID} - Attributes:`, JSON.stringify(attributes));
	console.log(`[SAVE_ARTWORK] Creator address:`, nft.creator);

	// Ensure dimensions is treated as JSON, default to empty object if null/undefined
	const dimensions = JSON.stringify(nft.dimensions || {});

	try {
		// Use a transaction to ensure both the artwork and artist relationship are created/updated atomically
		return await prisma.$transaction(async (tx) => {
			// First try to find the existing artwork
			const existingArtwork = await tx.artwork.findUnique({
				where: {
					tokenID_contractAddr: {
						tokenID: String(nft.tokenID),
						contractAddr: nft.collection.contract
					}
				}
			});

			// Prepare the base artwork data
			const baseArtworkData = {
				enabled: true,
				title: nft.name ?? '',
				description: nft.description ?? '',
				image_url: nft.metadata.image_url ?? '',
				animation_url: nft.metadata.animation_url ?? '',
				attributes: attributes,
				blockchain: nft.collection.blockchain ?? '',
				dimensions: dimensions,
				contractAddr: nft.collection.contract,
				contractAlias: nft.contractAlias ?? '',
				mime: nft.mime ?? '',
				totalSupply: nft.collection.total_supply ?? null,
				tokenStandard: nft.token_standard ?? '',
				tokenID: String(nft.tokenID),
				mintDate: new Date(nft.updated_at)
			};

			let savedArtwork;
			if (existingArtwork) {
				// Update existing artwork
				savedArtwork = await tx.artwork.update({
					where: { id: existingArtwork.id },
					data: {
						...baseArtworkData,
						...(collectionId && {
							collectionId: collectionId
						})
					}
				});
			} else {
				// Create new artwork first
				savedArtwork = await tx.artwork.create({
					data: {
						...baseArtworkData,
						...(collectionId && {
							collectionId: collectionId
						})
					} as any // Using type assertion as a temporary workaround
				});

				// Then create the artist relationship
				await tx.artistArtworks.create({
					data: {
						artistId: artistId,
						artworkId: savedArtwork.id
					}
				});
			}

			// If updating and the artist relationship doesn't exist, create it
			if (existingArtwork) {
				const existingRelation = await tx.artistArtworks.findUnique({
					where: {
						artistId_artworkId: {
							artistId: artistId,
							artworkId: savedArtwork.id
						}
					}
				});

				if (!existingRelation) {
					await tx.artistArtworks.create({
						data: {
							artistId: artistId,
							artworkId: savedArtwork.id
						}
					});
				}
			}

			return savedArtwork;
		});
	} catch (error) {
		console.error('[SAVE_ARTWORK] Error:', error);
		throw error;
	}
}
