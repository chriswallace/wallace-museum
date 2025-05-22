import prisma from '$lib/prisma';
import type { Artist, ArtistAddress, Collection } from '@prisma/client';

// Define interfaces for expected data structures
interface SocialMediaAccounts {
	twitter?: string;
	instagram?: string;
	discord?: string;
	github?: string;
	linkedin?: string;
	website?: string; // Additional website URL if not in the main artist info
}

interface ArtistInfo {
	username?: string; // Optional as address can be fallback
	address: string;
	blockchain?: string; // Added to specify which blockchain the address belongs to
	bio?: string;
	avatarUrl?: string;
	website?: string;
	displayName?: string; // Added to support displayName from OpenSea
	social_media_accounts?: SocialMediaAccounts;
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
	tags?: string[] | string; // Add tags field that can be string or array
	collection_name?: string; // Add collection_name field
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
	dimensions?: { width?: number; height?: number } | string;
	contractAlias?: string;
	symbol?: string;
	creator?: string; // Add creator field from OpenSea API
}

export async function processArtist(artistInfo: ArtistInfo) {
	const zeroAddress = '0x0000000000000000000000000000000000000000';
	let artistName = artistInfo.username;

	console.log('[ARTIST_PROCESS] Processing artist with info:', JSON.stringify(artistInfo, null, 2));

	// Handle special case for ENS names
	const isEnsName = artistName && typeof artistName === 'string' && artistName.endsWith('.eth');

	// Normalize the artist name - special handling for ENS names and usernames
	if (artistName) {
		// Trim and normalize spaces
		artistName = artistName.trim().replace(/\s+/g, ' ');

		// Remove @ symbol from Twitter handles if present
		if (artistName.startsWith('@')) {
			artistName = artistName.substring(1);
		}
	}

	// Fallback to address if username is missing, empty, or zero address
	if (!artistName || artistName.trim() === '' || artistName === zeroAddress) {
		if (artistInfo.address && artistInfo.address !== zeroAddress) {
			// For Ethereum addresses, make them more readable with proper formatting
			if (artistInfo.address.startsWith('0x')) {
				// Keep it in the original format but normalize case
				artistName = artistInfo.address.toLowerCase();
			} else {
				artistName = artistInfo.address;
			}
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
		// TODO: Add these fields to the database schema for comprehensive artist social media info
		// discordUrl: artistInfo.social_media_accounts?.discord || '',
		// githubUrl: artistInfo.social_media_accounts?.github || '',
		// linkedinUrl: artistInfo.social_media_accounts?.linkedin || ''
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

			// Update existing artist data with new information if available
			const shouldUpdate =
				// Update if we're replacing an address-based name with a real name
				(artist.name === artistInfo.address && artistName !== artistInfo.address) ||
				// Update if we have more complete bio information
				(artistInfo.bio && (!artist.bio || artist.bio.length < artistInfo.bio.length)) ||
				// Update if we have more complete website URL
				(artistInfo.website && !artist.websiteUrl) ||
				// Update if we have an avatar URL and the current one is missing
				(artistInfo.avatarUrl && !artist.avatarUrl) ||
				// Update if we have social media handles that are currently missing
				(artistInfo.social_media_accounts?.twitter && !artist.twitterHandle) ||
				(artistInfo.social_media_accounts?.instagram && !artist.instagramHandle);

			if (shouldUpdate) {
				// Create updated data object with only the fields that should be updated
				const updateData: any = {};

				// Only update name if we're replacing an address with a real name
				if (artist.name === artistInfo.address && artistName !== artistInfo.address) {
					updateData.name = artistName;
				}

				// Only update other fields if they provide more information
				if (artistInfo.bio && (!artist.bio || artist.bio.length < artistInfo.bio.length)) {
					updateData.bio = artistInfo.bio;
				}

				if (artistInfo.website && !artist.websiteUrl) {
					updateData.websiteUrl = artistInfo.website;
				}

				if (artistInfo.avatarUrl && !artist.avatarUrl) {
					updateData.avatarUrl = artistInfo.avatarUrl;
				}

				if (artistInfo.social_media_accounts?.twitter && !artist.twitterHandle) {
					updateData.twitterHandle = artistInfo.social_media_accounts.twitter;
				}

				if (artistInfo.social_media_accounts?.instagram && !artist.instagramHandle) {
					updateData.instagramHandle = artistInfo.social_media_accounts.instagram;
				}

				// Update additional social fields if available in your database schema
				// if (artistInfo.social_media_accounts?.discord && !artist.discordUrl) {
				// 	updateData.discordUrl = artistInfo.social_media_accounts.discord;
				// }

				// if (artistInfo.social_media_accounts?.github && !artist.githubUrl) {
				// 	updateData.githubUrl = artistInfo.social_media_accounts.github;
				// }

				// if (artistInfo.social_media_accounts?.linkedin && !artist.linkedinUrl) {
				// 	updateData.linkedinUrl = artistInfo.social_media_accounts.linkedin;
				// }

				// Only perform update if there are fields to update
				if (Object.keys(updateData).length > 0) {
					console.log('[ARTIST_PROCESS] Updating artist with new information:', updateData);
					artist = (await prisma.artist.update({
						where: { id: artist.id },
						data: updateData,
						include: {
							addresses: true
						}
					})) as Artist & { addresses: ArtistAddress[] };
					console.log('[ARTIST_PROCESS] Updated artist record:', artist.name);
				}
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

	// For ENS names, we should also try to find artist by the ENS name directly
	if (isEnsName) {
		const existingArtistByEns = await prisma.artist.findFirst({
			where: {
				OR: [{ name: artistName }, { name: { contains: artistName, mode: 'insensitive' } }]
			},
			include: {
				addresses: true
			}
		});

		if (existingArtistByEns) {
			artist = existingArtistByEns as Artist & { addresses: ArtistAddress[] };
			console.log('[ARTIST_PROCESS] Found existing artist by ENS name:', artist.name);

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

			return artist;
		}
	}

	// If no artist found by address or ENS name, try to find by regular name
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
			console.log('[ARTIST_PROCESS] Creating new artist with data:', artistData);
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
	let attributes = nft.metadata.attributes || [];

	// If attributes is a string, try to parse it (in case it's already stringified JSON)
	if (typeof attributes === 'string') {
		try {
			attributes = JSON.parse(attributes);
		} catch (e) {
			console.warn(`Failed to parse attributes string: ${e}`);
			attributes = [];
		}
	}

	// Validate that collection contract exists
	if (!nft.collection || !nft.collection.contract) {
		throw new Error(`Missing contract address for NFT ${nft.tokenID}`);
	}

	// Ensure dimensions has proper width and height values
	let normalizedDimensions = null;
	if (nft.dimensions) {
		// Handle case where dimensions might be a stringified JSON object
		if (typeof nft.dimensions === 'string') {
			try {
				const parsedDimensions = JSON.parse(nft.dimensions);
				if (
					parsedDimensions &&
					typeof parsedDimensions.width === 'number' &&
					typeof parsedDimensions.height === 'number'
				) {
					normalizedDimensions = parsedDimensions;
				}
			} catch (e) {
				console.warn(`Failed to parse dimensions string: ${e}`);
			}
		} else if (
			typeof nft.dimensions === 'object' &&
			nft.dimensions !== null &&
			typeof nft.dimensions.width === 'number' &&
			typeof nft.dimensions.height === 'number'
		) {
			normalizedDimensions = {
				width: nft.dimensions.width,
				height: nft.dimensions.height
			};
		}
	}

	console.log(`Normalized Dimensions:`, normalizedDimensions);

	// Generate tags from attributes
	let tags: string[] = [];
	if (Array.isArray(attributes) && attributes.length > 0) {
		// Extract meaningful values from attributes to use as tags
		tags = attributes
			.filter(
				(attr) => attr && typeof attr === 'object' && attr.value && String(attr.value).trim() !== ''
			)
			.map((attr) => String(attr.value).trim())
			// Remove duplicates
			.filter((value, index, self) => self.indexOf(value) === index);
	}

	// Ensure we have tags if they're provided directly
	if (nft.metadata.tags && Array.isArray(nft.metadata.tags)) {
		tags = [...tags, ...nft.metadata.tags];
	} else if (typeof nft.metadata.tags === 'string') {
		try {
			const parsedTags = JSON.parse(nft.metadata.tags);
			if (Array.isArray(parsedTags)) {
				tags = [...tags, ...parsedTags];
			}
		} catch (e) {
			console.warn(`Failed to parse tags string: ${e}`);
		}
	}

	// Determine the contract alias more effectively
	const contractAlias =
		nft.collection.name ||
		nft.contractAlias ||
		nft.metadata.collection_name ||
		nft.collection.contract;

	// Determine the mint date
	const mintDate = nft.updated_at ? new Date(nft.updated_at) : null;

	// Upsert artwork: create if it doesn't exist, update if it does
	const artworkData = {
		title: nft.name || 'Untitled',
		description: nft.description || '',
		curatorNotes: '',
		enabled: true,
		// Important: Store dimensions as a JSON object, not a string
		dimensions: normalizedDimensions,
		collectionId: collectionId,
		contractAddr: nft.collection.contract,
		contractAlias: contractAlias,
		tokenID: String(nft.tokenID),
		blockchain: nft.collection.blockchain || 'ethereum',
		tokenStandard: nft.token_standard || null,
		animation_url: nft.metadata.animation_url || null,
		image_url: nft.metadata.image_url || null,
		mime: nft.mime || null,
		symbol: nft.metadata.symbol || null,
		// Important: Store attributes as a JSON array, not a string
		attributes: attributes,
		// Important: Store tags as a JSON array, not a string
		tags: tags,
		mintDate: mintDate
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
