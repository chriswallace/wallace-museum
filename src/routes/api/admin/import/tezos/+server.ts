import prisma from '$lib/prisma';
import { json } from '@sveltejs/kit';
import { normalizeTezosMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/objktHelpers';
import { processArtist, saveArtwork } from '$lib/adminOperations';
import { syncCollection } from '$lib/collectionSync';

export const POST = async ({ request }) => {
	try {
		const { nfts } = await request.json();

		if (!Array.isArray(nfts) || nfts.length === 0) {
			return json({ error: 'No NFTs provided for import.' }, { status: 400 });
		}

		let successfulImports = 0;
		let skippedImports = 0;

		// Process NFTs sequentially instead of in parallel
		for (const nft of nfts) {
			let fetchedMetadata = null;

			if (nft.metadata_url) {
				fetchedMetadata = await fetchMetadata(nft.metadata_url);
				if (fetchedMetadata) {
					nft.metadata = fetchedMetadata;
				}
			}

			// Ensure nft.metadata exists before proceeding
			if (!nft.metadata) {
				nft.metadata = {};
			}

			// Process artist info
			const artistInfo = {
				username: nft.artist?.username || nft.artist?.name,
				address: nft.artist?.address || '',
				blockchain: 'tezos',
				bio: nft.artist?.bio,
				avatarUrl: nft.artist?.avatarUrl,
				website: nft.artist?.website,
				social_media_accounts: {
					twitter: nft.artist?.twitter || '',
					instagram: nft.artist?.instagram || ''
				}
			};

			const artist = await processArtist(artistInfo);

			// If no valid artist was found or created, skip this artwork
			if (!artist) {
				console.log('[TEZOS_IMPORT] No valid artist found for NFT:', nft.tokenID);
				skippedImports++;
				continue;
			}

			// Sync collection from Objkt.com
			const collection = await syncCollection(
				nft.collection?.contract || nft.contractAddr,
				'objkt'
			);

			let normalizedMetadata = await normalizeTezosMetadata(nft);

			// Log metadata attributes for debugging
			console.log(
				`[TEZOS_IMPORT] Token: ${nft.tokenID} - Normalized attributes:`,
				JSON.stringify(normalizedMetadata.attributes || [])
			);

			// Store final URLs and details here
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalMime = nft.mime || '';

			try {
				// Process animation_url if available
				if (normalizedMetadata.animation_url) {
					const animationResult = await handleMediaUpload(normalizedMetadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;
						finalMime = animationResult.fileType || finalMime;
					}
				}

				// Process image_url if available
				if (normalizedMetadata.image_url) {
					const imageResult = await handleMediaUpload(normalizedMetadata.image_url, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						if (!finalMime) {
							finalMime = imageResult.fileType || '';
						}
					}
				}
			} catch (error) {
				console.error('[TEZOS_IMPORT] Error processing media:', error);
			}

			// Update metadata with final URLs
			const finalMetadata = {
				...normalizedMetadata,
				image_url: finalImageUrl || normalizedMetadata.image_url,
				animation_url: finalAnimationUrl || normalizedMetadata.animation_url
			};

			console.log(`[IMPORT_SAVE]   - NFT Metadata Image URL: ${finalMetadata.image_url}`);
			console.log(`[IMPORT_SAVE]   - NFT Metadata Animation URL: ${finalMetadata.animation_url}`);
			console.log(`[IMPORT_SAVE]   - NFT Mime: ${finalMime}`);
			console.log(`[IMPORT_SAVE]   - NFT Dimensions:`, JSON.stringify(nft.dimensions));

			// Now save using the updated nft object
			const artwork = await saveArtwork(
				{
					...nft,
					metadata: finalMetadata,
					mime: finalMime,
					dimensions: nft.dimensions
				},
				artist.id,
				collection.id
			);

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

			successfulImports++;
		}

		return json({
			success: true,
			message: `Import completed successfully. ${successfulImports} artworks imported.`,
			skipped: skippedImports
		});
	} catch (error) {
		console.error('Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};
