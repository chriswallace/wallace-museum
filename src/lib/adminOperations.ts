import prisma from '$lib/prisma';
import { Artist, WalletAddress, Prisma } from '@prisma/client';
import { indexArtwork } from './artworkIndexer';
import { convertToIpfsUrl } from '$lib/pinataHelpers';
import { detectBlockchainFromContract } from '$lib/utils/walletUtils.js';
import { isProblematicThumbnail } from '$lib/constants/tezos';

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
	address: string;
	blockchain?: string;
	bio?: string;
	avatarUrl?: string;
	website?: string;
	displayName?: string;
	social_media_accounts?: SocialMediaAccounts;
	verified?: boolean;
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
	generator_url?: string; // Add generator_url support
	ipfs?: string; // Add ipfs field which sometimes contains generator URLs
	attributes?: any[]; // Keep attributes flexible for now
	symbol?: string;
	tags?: string[] | string; // Add tags field that can be string or array
	collection_name?: string; // Add collection_name field
	supply?: number; // Add supply field
	features?: any; // Add features field

	// Additional OpenSea metadata fields
	image?: string; // Alternative image field name
	image_details?: {
		width?: number;
		height?: number;
		size?: number;
	};
	animation_details?: {
		width?: number;
		height?: number;
		size?: number;
	};

	// Tezos-specific metadata fields
	thumbnail_uri?: string;
	artifact_uri?: string;
	display_uri?: string;

	// Date fields
	mint_date?: string;
	timestamp?: string;

	// Creator/artist
	creator?: string;

	// Additional media metadata
	file_size?: number;
	duration?: number;
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

	// OpenSea-specific fields at top level
	display_image_url?: string;
	display_animation_url?: string;
	metadata_url?: string;
	metadataUrl?: string; // Alternative casing
	opensea_url?: string;
	external_url?: string;
	image_url?: string; // Top-level image URL
	image_original_url?: string;
	is_disabled?: boolean;
	is_nsfw?: boolean;
	is_suspicious?: boolean;

	// Tezos-specific fields at top level
	thumbnail_uri?: string;
	artifact_uri?: string;
	display_uri?: string;
	supply?: number;
	owners?: any[];

	// Additional fields
	generator_url?: string;
}

const zeroAddress = '0x0000000000000000000000000000000000000000';

export async function processArtist(artistInfo: ArtistInfo) {
	const zeroAddress = '0x0000000000000000000000000000000000000000';
	let artistName = artistInfo.displayName;

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
			// For Ethereum addresses, keep them in their original format
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
		// TODO: Add these fields to the database schema for comprehensive artist social media info
		// discordUrl: artistInfo.social_media_accounts?.discord || '',
		// githubUrl: artistInfo.social_media_accounts?.github || '',
		// linkedinUrl: artistInfo.social_media_accounts?.linkedin || ''
	};

	let artist: (Artist & { walletAddresses: WalletAddress[] }) | null = null;

	// Try to find an existing artist by address first
	if (artistInfo.address && artistInfo.address !== zeroAddress) {
		const existingWalletAddress = await prisma.walletAddress.findUnique({
			where: {
				address_blockchain: {
					address: artistInfo.address,
					blockchain: artistInfo.blockchain || 'ethereum'
				}
			},
			include: {
				artist: {
					include: {
						walletAddresses: true
					}
				}
			}
		});

		if (existingWalletAddress && existingWalletAddress.artist) {
			artist = existingWalletAddress.artist as Artist & { walletAddresses: WalletAddress[] };
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
						include: { walletAddresses: true }
					})) as Artist & { walletAddresses: WalletAddress[] };
					console.log('[ARTIST_PROCESS] Updated artist record:', artist.name);
				}
			}

			// Ensure the specific address is linked if it wasn't the one found (e.g. artist has multiple addresses)
			const addressExists = artist.walletAddresses.find(
				(a: WalletAddress) =>
					a.address === artistInfo.address && a.blockchain === (artistInfo.blockchain || 'ethereum')
			);
			if (!addressExists) {
				await prisma.walletAddress.create({
					data: {
						artistId: artist.id,
						address: artistInfo.address,
						blockchain: artistInfo.blockchain || 'ethereum'
					}
				});
				// Re-fetch artist to include the new address
				artist = (await prisma.artist.findUnique({
					where: { id: artist.id },
					include: { walletAddresses: true }
				})) as Artist & { walletAddresses: WalletAddress[] };
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
				walletAddresses: true
			}
		});

		if (existingArtistByEns) {
			artist = existingArtistByEns as Artist & { walletAddresses: WalletAddress[] };
			console.log('[ARTIST_PROCESS] Found existing artist by ENS name:', artist.name);

			// If an address is provided and not yet linked, link it
			if (artistInfo.address && artistInfo.address !== zeroAddress) {
				const addressExists = artist.walletAddresses.find(
					(a: WalletAddress) =>
						a.address === artistInfo.address &&
						a.blockchain === (artistInfo.blockchain || 'ethereum')
				);

				if (!addressExists) {
					await prisma.walletAddress.create({
						data: {
							artistId: artist.id,
							address: artistInfo.address,
							blockchain: artistInfo.blockchain || 'ethereum'
						}
					});
					// Re-fetch artist to include the new address
					artist = (await prisma.artist.findUnique({
						where: { id: artist.id },
						include: { walletAddresses: true }
					})) as Artist & { walletAddresses: WalletAddress[] };
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
				walletAddresses: true
			}
		});

		if (existingArtistByName) {
			artist = existingArtistByName as Artist & { walletAddresses: WalletAddress[] };
			console.log('[ARTIST_PROCESS] Found existing artist by name:', artist.name);
			// If an address is provided and not yet linked, link it
			if (artistInfo.address && artistInfo.address !== zeroAddress) {
				const addressExists = artist.walletAddresses.find(
					(a: WalletAddress) =>
						a.address === artistInfo.address &&
						a.blockchain === (artistInfo.blockchain || 'ethereum')
				);
				if (!addressExists) {
					await prisma.walletAddress.create({
						data: {
							artistId: artist.id,
							address: artistInfo.address,
							blockchain: artistInfo.blockchain || 'ethereum'
						}
					});
					// Re-fetch artist to include the new address
					artist = (await prisma.artist.findUnique({
						where: { id: artist.id },
						include: { walletAddresses: true }
					})) as Artist & { walletAddresses: WalletAddress[] };
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
				// First check if the wallet address already exists
				let existingWalletAddress = null;
				if (artistInfo.address && artistInfo.address !== zeroAddress) {
					existingWalletAddress = await prisma.walletAddress.findUnique({
						where: {
							address_blockchain: {
								address: artistInfo.address,
								blockchain: artistInfo.blockchain || 'ethereum'
							}
						}
					});
				}

				if (existingWalletAddress) {
					// If wallet address exists but has no artist, create artist and link it
					if (!existingWalletAddress.artistId) {
						artist = (await prisma.artist.create({
							data: artistData,
							include: { walletAddresses: true }
						})) as Artist & { walletAddresses: WalletAddress[] };

						// Link the existing wallet address to the new artist
						await prisma.walletAddress.update({
							where: { id: existingWalletAddress.id },
							data: { artistId: artist.id }
						});

						// Re-fetch artist to include the linked address
						artist = (await prisma.artist.findUnique({
							where: { id: artist.id },
							include: { walletAddresses: true }
						})) as Artist & { walletAddresses: WalletAddress[] };
					} else {
						// Wallet address already has an artist - this shouldn't happen if our logic above is correct
						console.warn('[ARTIST_PROCESS] Wallet address already linked to another artist');
						return null;
					}
				} else {
					// Create new artist with new wallet address
					artist = (await prisma.artist.create({
						data: {
							...artistData,
							walletAddresses:
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
						include: { walletAddresses: true }
					})) as Artist & { walletAddresses: WalletAddress[] };
				}
			} catch (error: any) {
				if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
					// If name conflict, append part of the address or timestamp to make it unique
					console.log('[ARTIST_PROCESS] Name conflict detected, making name unique');
					const timestamp = Date.now().toString().slice(-6);
					
					// Check again for existing wallet address for the retry
					let existingWalletAddress = null;
					if (artistInfo.address && artistInfo.address !== zeroAddress) {
						existingWalletAddress = await prisma.walletAddress.findUnique({
							where: {
								address_blockchain: {
									address: artistInfo.address,
									blockchain: artistInfo.blockchain || 'ethereum'
								}
							}
						});
					}

					if (existingWalletAddress && !existingWalletAddress.artistId) {
						// Create artist with unique name and link existing wallet
						artist = (await prisma.artist.create({
							data: {
								...artistData,
								name: `${artistName}_${timestamp}`
							},
							include: { walletAddresses: true }
						})) as Artist & { walletAddresses: WalletAddress[] };

						// Link the existing wallet address to the new artist
						await prisma.walletAddress.update({
							where: { id: existingWalletAddress.id },
							data: { artistId: artist.id }
						});

						// Re-fetch artist to include the linked address
						artist = (await prisma.artist.findUnique({
							where: { id: artist.id },
							include: { walletAddresses: true }
						})) as Artist & { walletAddresses: WalletAddress[] };
					} else {
						// Create artist with unique name and new wallet address
						artist = (await prisma.artist.create({
							data: {
								...artistData,
								name: `${artistName}_${timestamp}`,
								walletAddresses:
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
							include: { walletAddresses: true }
						})) as Artist & { walletAddresses: WalletAddress[] };
					}
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
	nft: NftInfo, // Input NftInfo might contain various raw URLs from APIs
	collectionId: number | null // This is Collection.id, still relevant
) {
	let attributes = nft.metadata.attributes || [];
	if (typeof attributes === 'string') {
		try {
			attributes = JSON.parse(attributes);
		} catch (e) {
			console.warn(`Failed to parse attributes string: ${e}`);
			attributes = [];
		}
	}

	if (!nft.collection || !nft.collection.contract) {
		throw new Error(`Missing contract address for NFT ${nft.tokenID}`);
	}

	// Attempt to get primary image dimensions from various possible locations in NftInfo
	let primaryImageDimensions: { width: number; height: number } | null = null;
	if (nft.dimensions) {
		if (typeof nft.dimensions === 'string') {
			try {
				const parsed = JSON.parse(nft.dimensions);
				if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
					primaryImageDimensions = parsed;
				}
			} catch {}
		} else if (
			typeof nft.dimensions === 'object' &&
			nft.dimensions !== null &&
			typeof nft.dimensions.width === 'number' &&
			typeof nft.dimensions.height === 'number'
		) {
			primaryImageDimensions = nft.dimensions as { width: number; height: number };
		}
	} else if (nft.metadata?.image_details && nft.metadata.image_details.width && nft.metadata.image_details.height) {
		primaryImageDimensions = {
			width: nft.metadata.image_details.width,
			height: nft.metadata.image_details.height
		};
	}

	let tags: string[] = [];
	if (nft.metadata.tags && Array.isArray(nft.metadata.tags)) {
		tags = nft.metadata.tags;
	} else if (typeof nft.metadata.tags === 'string') {
		tags = nft.metadata.tags
			.split(',')
			.map((t) => t.trim())
			.filter((t) => t);
	} else if (attributes && Array.isArray(attributes) && attributes.length > 0) {
		tags = attributes
			.filter((attr) => attr && attr.value)
			.map((attr) => String(attr.value))
			.slice(0, 5);
	}

	let contractAlias = nft.collection?.name || '';

	let mintDate = null;
	if (nft.metadata.mint_date || nft.metadata.timestamp) {
		const dateString = nft.metadata.mint_date || nft.metadata.timestamp;
		try {
			mintDate = new Date(dateString as string);
			if (isNaN(mintDate.getTime())) mintDate = null;
		} catch (e) {
			console.warn(`Failed to parse mint date: ${dateString}`);
			mintDate = null;
		}
	}

	// --- Prepare media URLs and mime types ---
	// This function does not call handleMediaUpload; it assumes URLs in NftInfo are what we want to save.
	// Prioritization for image_url (primary display image)
	const final_image_url =
		nft.metadata?.image_url ||
		nft.metadata?.image ||
		nft.image_url ||
		nft.image_original_url ||
		nft.metadata?.display_uri ||
		null;

	// Prioritization for animation_url (video, gif, interactive)
	let final_animation_url =
		nft.metadata?.animation_url || nft.metadata?.artifact_uri || nft.generator_url || nft.metadata?.ipfs || null;

	// Fix #1: Only import gifs, videos, and code-powered artworks into animation_url
	if (final_animation_url) {
		const animationMime = guessMimeTypeFromUrl(final_animation_url);
		
		// Only keep animation_url for:
		// 1. Videos (mp4, webm, mov, etc.)
		// 2. GIFs
		// 3. Interactive/code-powered content (html, js, or known platforms)
		// 4. IPFS URLs (which often don't have extensions but may be valid media)
		// 5. URLs that look like they might be generators or interactive content
		if (animationMime) {
			const isValidAnimationType = 
				animationMime.startsWith('video/') || 
				animationMime === 'image/gif' ||
				animationMime === 'text/html' ||
				animationMime === 'application/javascript' ||
				isInteractivePlatform(final_animation_url);
			
			if (!isValidAnimationType) {
				final_animation_url = null; // Don't use animation_url for static images
			}
		} else {
			// If we can't determine the MIME type, be more permissive
			// Keep the URL if it's:
			// 1. From a known interactive platform
			// 2. An IPFS URL (which often don't have extensions)
			// 3. Contains keywords suggesting it might be interactive/generative content
			// 4. Has query parameters or fragments (suggesting dynamic content)
			const isIpfsUrl = final_animation_url.startsWith('ipfs://') || final_animation_url.includes('/ipfs/');
			const hasInteractiveKeywords = /(?:generator|interactive|live|render|viewer|player|embed|animation|video|gif)/i.test(final_animation_url);
			const hasDynamicParams = final_animation_url.includes('?') || final_animation_url.includes('#');
			
			if (!isInteractivePlatform(final_animation_url) && !isIpfsUrl && !hasInteractiveKeywords && !hasDynamicParams) {
				final_animation_url = null;
			}
		}
	}

	// If image_url is a video/gif and no separate animation_url, use image_url for animation_url too.
	// This is a heuristic; handleMediaUpload is more robust.
	const imageMimeType =
		nft.mime || (final_image_url ? guessMimeTypeFromUrl(final_image_url) : null);
	if (
		final_image_url &&
		!final_animation_url &&
		imageMimeType &&
		(imageMimeType.startsWith('video/') || imageMimeType === 'image/gif')
	) {
		final_animation_url = final_image_url;
	}

	// Determine mime type for the primary image_url
	const primary_mime = imageMimeType;

	// --- Construct mediaMetadata JSON object ---
	const mediaMetadata: any = {};
	if (primaryImageDimensions) {
		mediaMetadata.image_dimensions = primaryImageDimensions;
	}
	if (final_image_url) {
		mediaMetadata.source_image_uri = final_image_url; // Store the chosen one as source for now
	}

	if (final_animation_url) {
		mediaMetadata.source_animation_uri = final_animation_url;
		const animationMime =
			(nft.metadata?.artifact_uri &&
				(nft.metadata as any).formats?.find((f: any) => f.uri === nft.metadata.artifact_uri)
					?.mimeType) ||
			(nft.generator_url ? 'text/html' : null) ||
			(final_animation_url ? guessMimeTypeFromUrl(final_animation_url) : null);
		if (animationMime) {
			mediaMetadata.animation_mime_type = animationMime;
		}
		if (nft.metadata?.animation_details) {
			mediaMetadata.animation_dimensions = {
				width: nft.metadata.animation_details.width,
				height: nft.metadata.animation_details.height
			};
		} else if (final_animation_url === final_image_url && primaryImageDimensions) {
			mediaMetadata.animation_dimensions = primaryImageDimensions;
		}
	}

	if (nft.metadata?.file_size) {
		mediaMetadata.file_size_bytes = nft.metadata.file_size;
	}
	if (nft.metadata?.duration) {
		mediaMetadata.duration_seconds = nft.metadata.duration;
	}
	if (nft.generator_url) {
		// Explicitly add generator_url if present at top or metadata
		mediaMetadata.generator_url = nft.generator_url;
	} else if (nft.metadata?.generator_url) {
		mediaMetadata.generator_url = nft.metadata.generator_url;
	} else if (nft.metadata?.ipfs) {
		// Check if metadata.ipfs field contains a generator URL
		mediaMetadata.generator_url = nft.metadata.ipfs;
	}

	// --- Artist and WalletAddress Linking ---
	let artistId: number | undefined;
	const rawCreatorAddress = nft.creator || nft.metadata?.creator || null;
	const contractAddress = nft.collection?.contract;
	const artworkBlockchain = contractAddress ? detectBlockchainFromContract(contractAddress) : 'ethereum'; // Use contract-based detection

	if (rawCreatorAddress) {
		try {
			// Create or find artist using the new schema with JSON wallet addresses
			const creatorAddress = rawCreatorAddress;
			const artistName = `Artist_${creatorAddress.slice(-8)}`;
			
			// First, search all artists to find one with this wallet address
			let artist: any = null;
			const allArtists: any[] = await prisma.artist.findMany();

			// Check if any artist has this wallet address
			artist = allArtists.find(a => {
				if (!a.walletAddresses || !Array.isArray(a.walletAddresses)) return false;
				return (a.walletAddresses as any[]).some((w: any) => 
					w.address === creatorAddress
				);
			}) || null;

			if (!artist) {
				// Try to find by exact name match as fallback
				try {
					artist = await prisma.artist.findUnique({
						where: { name: artistName }
					});
				} catch (error) {
					// Ignore errors from name lookup
				}
			}

			if (!artist) {
				// Create new artist with wallet address
				const walletAddresses = [{
					address: creatorAddress,
					blockchain: artworkBlockchain,
					lastIndexed: new Date().toISOString()
				}];

				// Try to create with the base name first, handle conflicts
				let finalArtistName = artistName;
				let createAttempts = 0;
				const maxAttempts = 5;

				while (createAttempts < maxAttempts) {
					try {
						artist = await prisma.artist.create({
							data: {
								name: finalArtistName,
								walletAddresses: walletAddresses as any
							}
						});
						break; // Success, exit the loop
					} catch (error: any) {
						if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
							// Name conflict, try with a unique suffix
							createAttempts++;
							const timestamp = Date.now().toString().slice(-6);
							finalArtistName = `${artistName}_${timestamp}`;
							console.log(`[ARTIST_IMPORT] Name conflict for "${artistName}", trying "${finalArtistName}"`);
						} else {
							throw error; // Re-throw non-name-conflict errors
						}
					}
				}

				if (!artist) {
					throw new Error(`Failed to create artist after ${maxAttempts} attempts due to name conflicts`);
				}
			} else {
				// Update existing artist and merge wallet addresses if needed
				const existingWallets = Array.isArray(artist.walletAddresses) ? artist.walletAddresses as any[] : [];
				const addressExists = existingWallets.some((w: any) => 
					w.address === creatorAddress
				);
				
				if (!addressExists) {
					const updatedWallets = [...existingWallets, {
						address: creatorAddress,
						blockchain: artworkBlockchain,
						lastIndexed: new Date().toISOString()
					}];

					artist = await prisma.artist.update({
						where: { id: artist.id },
						data: {
							updatedAt: new Date(),
							walletAddresses: updatedWallets as any
						}
					});
				}
			}

			artistId = artist.id;
		} catch (e) {
			console.error(
				`Error creating/updating Artist for ${rawCreatorAddress} on ${artworkBlockchain}:`,
				e
			);
		}
	}

	// Compute UID for upsert (hash of contractAddress:tokenId)
	const uid = `${nft.collection.contract}:${nft.tokenID}`;

	let dimensionsValue: { width: number; height: number } | undefined = undefined;
	if (
		primaryImageDimensions &&
		typeof primaryImageDimensions.width === 'number' &&
		typeof primaryImageDimensions.height === 'number' &&
		primaryImageDimensions.width !== undefined &&
		primaryImageDimensions.height !== undefined
	) {
		dimensionsValue = {
			width: primaryImageDimensions.width,
			height: primaryImageDimensions.height
		};
	}

	const artworkData: Prisma.ArtworkUpdateInput | Prisma.ArtworkCreateInput = {
		title: nft.name || 'Untitled',
		description: nft.description || '',
		collection: collectionId ? { connect: { id: collectionId } } : undefined,
		contractAddress: nft.collection.contract,
		tokenId: String(nft.tokenID),
		blockchain: artworkBlockchain,
		tokenStandard: nft.token_standard || (artworkBlockchain === 'ethereum' ? 'ERC721' : 'FA2'),
		imageUrl: final_image_url ? convertToIpfsUrl(final_image_url) : final_image_url,
		animationUrl: final_animation_url ? convertToIpfsUrl(final_animation_url) : final_animation_url,
		// Add thumbnailUrl from various sources - prioritize based on blockchain
		thumbnailUrl: (() => {
			let thumbnailUrl = artworkBlockchain?.toLowerCase() === 'tezos' 
				? (nft.metadata?.thumbnail_uri || nft.thumbnail_uri || nft.metadata?.display_uri || nft.display_uri || null)
				: (nft.metadata?.display_uri || nft.display_uri || nft.metadata?.thumbnail_uri || nft.thumbnail_uri || null);
			
			// If we have a problematic thumbnail, use the main image instead
			if (isProblematicThumbnail(thumbnailUrl)) {
				console.log(`[saveArtwork] Detected problematic thumbnail for ${nft.collection.contract}:${nft.tokenID}, using display/artifact image instead`);
				thumbnailUrl = final_image_url;
			}
			
			// Don't store thumbnail URL if it's the same as the main image URL
			if (thumbnailUrl && final_image_url && thumbnailUrl === final_image_url) {
				console.log(`[saveArtwork] Thumbnail URL is same as image URL for ${nft.collection.contract}:${nft.tokenID}, storing null to avoid duplication`);
				thumbnailUrl = null;
			}
			
			return thumbnailUrl ? convertToIpfsUrl(thumbnailUrl) : thumbnailUrl;
		})(),
		mime: primary_mime,
		dimensions: dimensionsValue,
		// Add supply field
		supply: nft.supply || nft.metadata?.supply || null,
		metadataUrl: (() => {
			const metadataUrl = nft.metadata_url || (nft as any).metadataUrl || null;
			return metadataUrl ? convertToIpfsUrl(metadataUrl) : metadataUrl;
		})(),
		attributes: attributes.length > 0 ? attributes : Prisma.JsonNull,
		// Add features field if available
		features: nft.metadata?.features ? nft.metadata.features : Prisma.JsonNull,
		mintDate: mintDate,
		uid: uid
	};

	const artwork = await prisma.artwork.upsert({
		where: { uid },
		update: artworkData as Prisma.ArtworkUpdateInput, // Cast to make TS happy with shared object
		create: artworkData as Prisma.ArtworkCreateInput
	});

	// Create artwork-artist relationship if we have a creator
	if (artistId && artwork) {
		try {
			// Connect the artwork directly to the artist using the many-to-many relationship
			await prisma.artwork.update({
				where: { id: artwork.id },
				data: {
					artists: {
						connect: { id: artistId }
					}
				} as any
			});
		} catch (e) {
			console.error(
				`Error linking artwork ${artwork.id} to artist ${artistId}:`,
				e
			);
		}
	}

	// Pin artwork URLs to Pinata
	try {
		const artworkForPinning = {
			title: artwork.title,
			imageUrl: artwork.imageUrl,
			thumbnailUrl: artwork.thumbnailUrl,
			animationUrl: artwork.animationUrl,
			metadataUrl: artwork.metadataUrl
		};
		
		const { extractCidsFromArtwork, pinCidToPinata } = await import('$lib/pinataHelpers');
		const cids = extractCidsFromArtwork(artworkForPinning);
		if (cids.length > 0) {
			console.log(`Pinning ${cids.length} IPFS URLs for artwork: ${artwork.title}`);
			
			for (const cid of cids) {
				try {
					const pinName = `${artwork.title} - ${cid}`;
					await pinCidToPinata(cid, pinName);
					console.log(`Successfully pinned CID: ${cid} for artwork: ${artwork.title}`);
				} catch (pinError) {
					console.error(`Failed to pin CID ${cid} for artwork ${artwork.title}:`, pinError);
					// Continue with other CIDs even if one fails
				}
			}
		}
	} catch (pinningError) {
		console.error(`Error during Pinata pinning for artwork ${artwork.title}:`, pinningError);
		// Don't fail the import if pinning fails
	}

	// If successful, index the artwork
	try {
		if (artwork) {
			await indexArtwork(artwork.id);
		}
	} catch (indexError) {
		console.error(`Error indexing artwork ${artwork.id}: ${indexError}`);
		// Don't throw here, as we want to return the artwork even if indexing fails
	}

	return artwork;
}

// Helper function (consider moving to a utility file if used elsewhere)
function guessMimeTypeFromUrl(url: string): string | null {
	if (!url) return null;
	const extension = url.split('.').pop()?.toLowerCase();
	if (!extension) return null;

	const commonTypes: Record<string, string> = {
		// Images
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		// Videos
		mp4: 'video/mp4',
		webm: 'video/webm',
		mov: 'video/quicktime',
		avi: 'video/x-msvideo',
		// Interactive content
		html: 'text/html',
		htm: 'text/html',
		js: 'application/javascript'
	};

	return commonTypes[extension] || null;
}

// Helper function to check if URL is from a known interactive/generative art platform
function isInteractivePlatform(url: string): boolean {
	if (!url) return false;
	
	const interactivePlatforms = [
		'fxhash.xyz',
		'generator.artblocks.io',
		'artblocks.io',
		'async.art',
		'foundation.app',
		'superrare.com',
		'alba.art',
		'gmstudio.art',
		'highlight.xyz',
		'prohibition.art',
		'verse.works',
		'plottables.io',
		'tender.art',
		'objkt.com',
		'hicetnunc.art',
		'teia.art',
		'versum.xyz',
		'kalamint.io',
		'rarible.com',
		'opensea.io',
		'looksrare.org',
		'x2y2.io',
		'blur.io',
		'niftygateway.com',
		'makersplace.com',
		'knownorigin.io',
		'asyncart.com',
		'zora.co'
	];
	
	return interactivePlatforms.some(platform => url.includes(platform));
}
