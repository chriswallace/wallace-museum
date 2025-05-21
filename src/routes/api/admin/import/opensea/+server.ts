import prisma from '$lib/prisma.js';
import { json } from '@sveltejs/kit';
import { normalizeOpenSeaMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/openseaHelpers.js';
import { processArtist, processCollection, saveArtwork } from '$lib/adminOperations.js';
import { isVideo, isImage } from '$lib/utils';
import { syncCollection } from '$lib/collectionSync';

interface Dimensions {
	width: number;
	height: number;
}

const DEFAULT_DIMENSIONS: Dimensions = {
	width: 1000,
	height: 1000
};

export const POST = async ({ request }) => {
	try {
		const { nfts } = await request.json();

		if (!Array.isArray(nfts) || nfts.length === 0) {
			return json({ error: 'No NFTs provided for import.' }, { status: 400 });
		}

		const importPromises = nfts.map(async (nft) => {
			// Fetch metadata if available
			let fetchedMetadata = null;
			if (nft.metadata_url) {
				try {
					fetchedMetadata = await fetchMetadata(nft.metadata_url);
					if (fetchedMetadata) {
						nft.metadata = fetchedMetadata;
					}
				} catch (error) {
					console.warn(`[OS_IMPORT] Failed to fetch metadata for NFT ${nft.identifier}:`, error);
				}
			}

			// Process artist from metadata
			console.log('[OS_IMPORT] Raw NFT data:', {
				metadata_artist: nft.metadata?.artist,
				creator: nft.creator,
				metadata_creator_name: nft.metadata?.creator?.name,
				metadata_creator: nft.metadata?.creator,
				raw_nft: nft
			});

			const artistInfo = {
				username:
					nft.artist?.username ||
					nft.metadata?.artist ||
					nft.creator ||
					nft.metadata?.creator?.name ||
					nft.metadata?.creator,
				address:
					nft.artist?.address ||
					nft.creator ||
					nft.metadata?.creator?.address ||
					nft.creator_address,
				blockchain: nft.collection?.blockchain?.toLowerCase() || 'ethereum',
				bio: nft.metadata?.creator?.bio || nft.metadata?.creator?.description,
				avatarUrl: nft.metadata?.creator?.image || nft.metadata?.creator?.avatar,
				website: nft.metadata?.creator?.website || nft.metadata?.creator?.external_url,
				social_media_accounts: {
					twitter: nft.metadata?.creator?.twitter || '',
					instagram: nft.metadata?.creator?.instagram || ''
				}
			};

			console.log('[OS_IMPORT] Processed artist info:', artistInfo);

			// Process artist with complete info
			const artist = await processArtist(artistInfo);

			// If no valid artist was found or created, skip this artwork
			if (!artist) {
				console.log('[OS_IMPORT] No valid artist found for NFT:', nft.identifier);
				return null;
			}

			console.log('[OS_IMPORT] Final processed artist:', artist);

			// Sync collection from OpenSea
			const collection = await syncCollection(
				nft.collection?.slug || nft.collection?.contract || nft.contractAddr,
				'opensea'
			);

			// Process media URLs
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalGeneratorUrl = '';
			let finalMime = '';
			let finalDimensions = DEFAULT_DIMENSIONS;

			try {
				// First check for generator URL
				if (nft.metadata?.generator_url) {
					console.log(`[OS_IMPORT] Found generator URL for NFT ${nft.identifier}`);
					finalGeneratorUrl = nft.metadata.generator_url;
					finalMime = 'text/html'; // Generator URLs are typically HTML
				}

				// Process animation_url if available and no generator URL
				if (nft.metadata?.animation_url && !finalGeneratorUrl) {
					console.log(`[OS_IMPORT] Processing animation_url for NFT ${nft.identifier}`);
					const animationResult = await handleMediaUpload(nft.metadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;
						finalMime = animationResult.fileType;
						finalDimensions = {
							width: animationResult.dimensions.width,
							height: animationResult.dimensions.height
						};
					}
				}

				// Process image_url if available
				if (nft.metadata?.image_url) {
					console.log(`[OS_IMPORT] Processing image_url for NFT ${nft.identifier}`);
					const imageResult = await handleMediaUpload(nft.metadata.image_url, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						if (!finalMime) finalMime = imageResult.fileType;
						if (!finalDimensions.width) {
							finalDimensions = {
								width: imageResult.dimensions.width,
								height: imageResult.dimensions.height
							};
						}
					}
				}
			} catch (error) {
				console.error('[OS_IMPORT] Error processing media:', error);
			}

			// Update metadata with final URLs
			const finalMetadata = {
				...nft.metadata,
				image_url: finalImageUrl || nft.metadata?.image_url,
				animation_url: finalAnimationUrl || nft.metadata?.animation_url,
				generator_url: finalGeneratorUrl || nft.metadata?.generator_url
			};

			// Save artwork
			const artwork = await saveArtwork(
				{
					...nft,
					metadata: finalMetadata,
					mime: finalMime,
					dimensions: finalDimensions,
					tokenID: nft.identifier || nft.tokenId || nft.tokenID,
					generator_url: finalGeneratorUrl
				},
				artist.id,
				collection.id
			);

			// Create artist-collection relationship
			await prisma.artistCollections.upsert({
				where: {
					artistId_collectionId: {
						artistId: artist.id,
						collectionId: collection.id
					}
				},
				update: {},
				create: {
					artistId: artist.id,
					collectionId: collection.id
				}
			});

			// Create artist-artwork relationship
			await prisma.artistArtworks.upsert({
				where: {
					artistId_artworkId: {
						artistId: artist.id,
						artworkId: artwork.id
					}
				},
				update: {},
				create: {
					artistId: artist.id,
					artworkId: artwork.id
				}
			});

			return artwork;
		});

		// Filter out null results (skipped artworks) and wait for all promises
		const results = await Promise.all(importPromises);
		const successfulImports = results.filter((result) => result !== null);

		return json({
			success: true,
			message: `Import completed successfully. ${successfulImports.length} artworks imported.`,
			skipped: results.length - successfulImports.length
		});
	} catch (error) {
		console.error('[OS_IMPORT] Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};
