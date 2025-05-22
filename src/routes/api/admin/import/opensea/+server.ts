import prisma from '$lib/prisma.js';
import { json } from '@sveltejs/kit';
import { normalizeOpenSeaMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata, fetchCreatorInfo } from '$lib/openseaHelpers.js';
import { processArtist, processCollection, saveArtwork } from '$lib/adminOperations.js';
import { isVideo, isImage } from '$lib/utils';
import { syncCollection } from '$lib/collectionSync';
import { Prisma } from '@prisma/client';

/**
 * OpenSea NFT Import API
 *
 * Enhanced Artist Detection and Import:
 * - Extracts artist information from multiple sources:
 *   1. NFT traits (including parametric artist traits for generative art)
 *   2. NFT metadata attributes
 *   3. Direct artist fields in metadata
 *   4. OpenSea API creator info
 *
 * - Comprehensive artist profile creation with:
 *   - Username, display name, bio
 *   - Blockchain addresses and proper association
 *   - Avatar URLs and website links
 *   - Social media accounts (Twitter, Instagram, Discord, etc.)
 *
 * - Smart artist matching and updating:
 *   - Finds existing artists by address
 *   - Handles ENS names (.eth) with special matching
 *   - Updates existing artists with richer information
 *   - Links multiple addresses to a single artist
 */

interface Dimensions {
	width: number;
	height: number;
}

// const DEFAULT_DIMENSIONS: Dimensions = {
// 	width: 1000,
// 	height: 1000
// };

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

			// Enhanced logic to extract artist information from multiple sources
			let creatorAddress =
				nft.creator || nft.metadata?.creator?.address || nft.creator_address || null;

			// Check for parametric artist in traits (common in generative art platforms like QQL)
			let parametricArtist = null;

			// Function to search for artist information in trait arrays
			const findArtistInTraits = (traits: any[]) => {
				if (!Array.isArray(traits)) return null;

				// Look for common artist trait types in generative art platforms
				const artistTraitTypes = [
					'Parametric Artist',
					'Artist',
					'Creator',
					'Author',
					'Designer',
					'Collaborator',
					'Made By',
					'Created By'
				];

				for (const traitType of artistTraitTypes) {
					const artistTrait = traits.find(
						(trait: any) =>
							trait.trait_type === traitType && trait.value && typeof trait.value === 'string'
					);

					if (artistTrait) {
						return artistTrait.value;
					}
				}

				return null;
			};

			// Check NFT traits first
			if (nft.traits && Array.isArray(nft.traits)) {
				parametricArtist = findArtistInTraits(nft.traits);
				if (parametricArtist) {
					console.log(`[OS_IMPORT] Found artist in NFT traits: ${parametricArtist}`);
				}
			}

			// Check metadata attributes if no artist found yet
			if (!parametricArtist && nft.metadata?.attributes && Array.isArray(nft.metadata.attributes)) {
				parametricArtist = findArtistInTraits(nft.metadata.attributes);
				if (parametricArtist) {
					console.log(`[OS_IMPORT] Found artist in metadata attributes: ${parametricArtist}`);
				}
			}

			// Check for direct artist fields in metadata
			if (!parametricArtist && !creatorAddress) {
				// Look for common artist fields in NFT metadata
				const artistFieldNames = [
					'artist',
					'creator',
					'author',
					'designer',
					'made_by',
					'created_by'
				];

				for (const fieldName of artistFieldNames) {
					if (nft.metadata && nft.metadata[fieldName]) {
						if (typeof nft.metadata[fieldName] === 'string') {
							parametricArtist = nft.metadata[fieldName];
							console.log(`[OS_IMPORT] Found artist in metadata.${fieldName}: ${parametricArtist}`);
							break;
						} else if (
							typeof nft.metadata[fieldName] === 'object' &&
							nft.metadata[fieldName]?.name
						) {
							parametricArtist = nft.metadata[fieldName].name;

							// If we also found an address, save it
							if (nft.metadata[fieldName].address && !creatorAddress) {
								creatorAddress = nft.metadata[fieldName].address;
							}

							console.log(
								`[OS_IMPORT] Found artist in metadata.${fieldName}.name: ${parametricArtist}`
							);
							break;
						}
					}
				}
			}

			// If we found a creator address, fetch more details from OpenSea
			let creatorInfo: any = null;
			if (creatorAddress) {
				try {
					creatorInfo = await fetchCreatorInfo(creatorAddress);
					console.log(`[OS_IMPORT] Fetched creator info for ${creatorAddress}:`, creatorInfo);
				} catch (error) {
					console.warn(`[OS_IMPORT] Failed to fetch creator info: ${error}`);
				}
			}

			// Check if parametricArtist looks like an Ethereum address and use it as a fallback creator address
			if (
				parametricArtist &&
				typeof parametricArtist === 'string' &&
				parametricArtist.startsWith('0x') &&
				parametricArtist.length >= 40 &&
				!creatorAddress
			) {
				creatorAddress = parametricArtist;
				console.log(`[OS_IMPORT] Using parametric artist as creator address: ${creatorAddress}`);

				// Try to fetch creator info again with this address
				try {
					creatorInfo = await fetchCreatorInfo(creatorAddress);
				} catch (error) {
					console.warn(
						`[OS_IMPORT] Failed to fetch creator info from parametric artist address: ${error}`
					);
				}
			}

			// Combine all information sources to create a comprehensive artist profile
			const artistInfo = {
				username:
					nft.artist?.username ||
					parametricArtist || // Use artist from traits if available
					creatorInfo?.username ||
					creatorInfo?.displayName ||
					nft.metadata?.artist ||
					nft.metadata?.creator?.name ||
					nft.metadata?.creator ||
					nft.metadata?.parametricArtist,
				address:
					nft.artist?.address ||
					creatorAddress ||
					(parametricArtist && parametricArtist.startsWith('0x') ? parametricArtist : null),
				blockchain: nft.collection?.blockchain?.toLowerCase() || 'ethereum',
				bio:
					nft.artist?.bio ||
					creatorInfo?.bio ||
					nft.metadata?.creator?.bio ||
					nft.metadata?.creator?.description,
				avatarUrl:
					nft.artist?.avatarUrl ||
					creatorInfo?.avatarUrl ||
					nft.metadata?.creator?.image ||
					nft.metadata?.creator?.avatar,
				website:
					nft.artist?.website ||
					creatorInfo?.social_links?.website ||
					creatorInfo?.social_links?.external_url ||
					nft.metadata?.creator?.website ||
					nft.metadata?.creator?.external_url,
				social_media_accounts: {
					twitter:
						nft.artist?.social_media_accounts?.twitter ||
						creatorInfo?.social_links?.twitter ||
						nft.metadata?.creator?.twitter ||
						'',
					instagram:
						nft.artist?.social_media_accounts?.instagram ||
						creatorInfo?.social_links?.instagram ||
						nft.metadata?.creator?.instagram ||
						'',
					discord:
						nft.artist?.social_media_accounts?.discord ||
						creatorInfo?.social_links?.discord ||
						nft.metadata?.creator?.discord ||
						'',
					github:
						nft.artist?.social_media_accounts?.github ||
						creatorInfo?.social_links?.github ||
						nft.metadata?.creator?.github ||
						'',
					linkedin:
						nft.artist?.social_media_accounts?.linkedin ||
						creatorInfo?.social_links?.linkedin ||
						nft.metadata?.creator?.linkedin ||
						''
				}
			};

			// Log comprehensive artist info
			console.log('[OS_IMPORT] Comprehensive artist info:', JSON.stringify(artistInfo, null, 2));

			// Process artist with complete info
			const artist = await processArtist(artistInfo);

			// Additional debugging for artist processing
			if (artist) {
				console.log(`[OS_IMPORT] Successfully imported artist: ${artist.name} (ID: ${artist.id})`);
				if (artist.addresses && artist.addresses.length > 0) {
					console.log(
						`[OS_IMPORT] Artist has ${artist.addresses.length} associated addresses:`,
						artist.addresses.map((a) => `${a.address} (${a.blockchain})`)
					);
				}
			} else {
				console.warn(
					`[OS_IMPORT] Failed to import artist from info:`,
					JSON.stringify(artistInfo, null, 2)
				);
			}

			// If no valid artist was found or created, continue without artist association
			if (!artist) {
				console.warn('[OS_IMPORT] No valid artist found for NFT:', nft.identifier);
			}

			// Log the NFT data before collection sync to help with debugging
			console.log('[OS_IMPORT] NFT data:', {
				identifier: nft.identifier,
				collection: nft.collection,
				contractAddr: nft.contractAddr,
				contract: nft.contract
			});

			// Ensure we have a valid collection identifier
			let collectionIdentifier = '';

			// Try to get the collection identifier in order of preference
			if (nft.collection?.contract) {
				collectionIdentifier = nft.collection.contract;
				console.log('[OS_IMPORT] Using collection.contract:', collectionIdentifier);
			} else if (nft.collection?.slug) {
				collectionIdentifier = nft.collection.slug;
				console.log('[OS_IMPORT] Using collection.slug:', collectionIdentifier);
			} else if (nft.contractAddr) {
				collectionIdentifier = nft.contractAddr;
				console.log('[OS_IMPORT] Using contractAddr:', collectionIdentifier);
			} else if (nft.contract) {
				collectionIdentifier = nft.contract;
				console.log('[OS_IMPORT] Using contract:', collectionIdentifier);
			} else if (typeof nft.identifier === 'string' && nft.identifier.includes('/')) {
				// Try to extract contract from identifier if it's in format like "generic/id/contract"
				const parts = nft.identifier.split('/');
				if (parts.length >= 3 && parts[2].startsWith('0x')) {
					collectionIdentifier = parts[2];
					console.log('[OS_IMPORT] Extracted contract from identifier:', collectionIdentifier);
				}
			}

			// Validate the collection identifier
			if (!collectionIdentifier) {
				console.error('[OS_IMPORT] No valid collection identifier found for NFT:', nft.identifier);
				return null; // Skip this NFT
			}

			// Check if collection already exists in the database
			let collection;
			try {
				// First try to find the collection in our database by contractAddr or slug
				const existingCollection = await prisma.collection.findFirst({
					where: {
						OR: [
							{ slug: collectionIdentifier },
							// Use a simpler condition that works with Prisma JSON queries
							// This approach finds collections where the contractAddresses JSON contains the identifier string
							{ contractAddresses: { not: Prisma.JsonNull } }
						]
					}
				});

				// If we found collections with contractAddresses, double-check for the specific address
				let matchedCollection = null;
				if (
					existingCollection &&
					existingCollection.contractAddresses &&
					collectionIdentifier.startsWith('0x')
				) {
					const addresses = existingCollection.contractAddresses as any;
					// Check if the address exists in the collection's contract addresses
					if (
						Array.isArray(addresses) &&
						addresses.some(
							(addr: any) =>
								addr.address && addr.address.toLowerCase() === collectionIdentifier.toLowerCase()
						)
					) {
						matchedCollection = existingCollection;
					}
				} else if (existingCollection) {
					// If it matched by slug or doesn't have a contract address to check, use it
					matchedCollection = existingCollection;
				}

				if (matchedCollection) {
					console.log('[OS_IMPORT] Found existing collection in database:', {
						id: matchedCollection.id,
						slug: matchedCollection.slug,
						title: matchedCollection.title
					});
					collection = matchedCollection;
				} else {
					// If not found in database, sync from OpenSea
					collection = await syncCollection(collectionIdentifier, 'opensea');
					console.log('[OS_IMPORT] Collection synced successfully from API:', {
						id: collection.id,
						slug: collection.slug,
						title: collection.title
					});
				}

				// Ensure the collection has a valid ID
				if (!collection || !collection.id) {
					throw new Error('Collection sync failed to return a valid collection');
				}
			} catch (error) {
				console.error('[OS_IMPORT] Failed to sync collection:', error);
				// Try to create a basic collection as fallback
				try {
					collection = await prisma.collection.upsert({
						where: { slug: collectionIdentifier },
						create: {
							slug: collectionIdentifier,
							title: nft.collection?.name || 'Unknown Collection',
							description: nft.collection?.description || '',
							enabled: true,
							chainIdentifier: 'ethereum',
							contractAddresses: [
								{
									address: collectionIdentifier.startsWith('0x') ? collectionIdentifier : null,
									chain: 'ethereum'
								}
							] as Prisma.InputJsonValue
						},
						update: {}
					});
					console.log('[OS_IMPORT] Created fallback collection:', collection.slug);
				} catch (fallbackError) {
					console.error('[OS_IMPORT] Failed to create fallback collection:', fallbackError);
					return null; // Skip this NFT
				}
			}

			// Ensure the NFT has collection information
			if (!nft.collection) {
				nft.collection = {
					contract: collectionIdentifier.startsWith('0x') ? collectionIdentifier : collection.slug,
					name: collection.title,
					blockchain: 'ethereum'
				};
			} else if (!nft.collection.contract || !nft.collection.contract.startsWith('0x')) {
				// If collection exists but has no contract or it's not an address, use the one from our database
				// Prefer a real contract address (starting with 0x) over a slug
				nft.collection.contract = collectionIdentifier.startsWith('0x')
					? collectionIdentifier
					: collection.slug;
			}

			console.log('[OS_IMPORT] Final NFT collection:', nft.collection);

			// Process media URLs
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalGeneratorUrl = '';
			// Try to get an initial MIME type from the NFT data itself (OpenSea might provide it)
			let finalMime = nft.mime || nft.mime_type || '';
			let finalDimensions = null; // We'll get dimensions from Cloudinary uploads

			// Helper to determine if a MIME type is generic (application/octet-stream or empty)
			const isMimeEffectivelyGeneric = (mime: string) =>
				!mime || mime === 'application/octet-stream';

			try {
				// First check for generator URL (these are typically primary interactive content)
				if (nft.metadata?.generator_url) {
					finalGeneratorUrl = nft.metadata.generator_url;
					// Only set to text/html if no specific mime was already provided by OpenSea or if it was generic
					if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
						finalMime = 'text/html';
					}
				}

				// Process animation_url if available and no generator URL has taken precedence for the primary content
				if (nft.metadata?.animation_url && !finalGeneratorUrl) {
					const animationResult = await handleMediaUpload(nft.metadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;

						// Update mime type if we got one from the upload and it's more specific or current is generic
						if (animationResult.fileType) {
							const newMime = animationResult.fileType;
							const currentMimeIsGeneric = isMimeEffectivelyGeneric(finalMime);
							const newMimeIsPrimaryContent =
								newMime.startsWith('video/') ||
								newMime.startsWith('text/') ||
								newMime.includes('javascript') ||
								newMime === 'application/pdf' ||
								newMime.startsWith('model/');
							const currentMimeIsImage = finalMime.startsWith('image/');

							if (currentMimeIsGeneric) {
								finalMime = newMime;
							} else if (newMimeIsPrimaryContent && currentMimeIsImage) {
								finalMime = newMime;
							} else if (
								newMime !== finalMime &&
								finalMime === 'text/html' &&
								!newMimeIsPrimaryContent &&
								!newMime.startsWith('image/')
							) {
								finalMime = newMime;
							} else if (
								newMime !== finalMime &&
								!(
									(finalMime.startsWith('image/') ||
										finalMime.startsWith('video/') ||
										finalMime.startsWith('model/')) &&
									newMime === 'text/html'
								)
							) {
								finalMime = newMime;
							}
						}

						// Update dimensions from animation if available
						if (animationResult.dimensions) {
							finalDimensions = animationResult.dimensions;
						}
					} else {
						console.warn(`[OS_IMPORT] Animation upload failed for: ${nft.metadata.animation_url}`);
					}
				}

				// Process image_url (full resolution or original)
				// This should run whether animation_url was processed or not, as it might be the primary image or a poster.
				const primaryImageUrl = nft.metadata?.image_url || nft.image_url || nft.image_original_url;
				if (primaryImageUrl) {
					const imageResult = await handleMediaUpload(primaryImageUrl, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						console.log(`[OS_IMPORT] Full-resolution image upload successful: ${finalImageUrl}`);

						// Update mime type from image upload if it's an image type AND current finalMime is generic or text/html
						// This avoids overriding a primary video/interactive mime with a poster image's mime.
						if (imageResult.fileType?.startsWith('image/')) {
							if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
								finalMime = imageResult.fileType;
							}
						} else if (imageResult.fileType && isMimeEffectivelyGeneric(finalMime)) {
							// If not an image, but current mime is generic, update (e.g. SVG served as application/xml initially)
							finalMime = imageResult.fileType;
						}

						// Update dimensions from image upload if available and it seems primary or no dimensions yet
						if (imageResult.dimensions && (!finalDimensions || finalMime.startsWith('image/'))) {
							finalDimensions = imageResult.dimensions;
						}
					} else {
						console.warn(`[OS_IMPORT] Full-resolution image upload failed for: ${primaryImageUrl}`);
					}
				}

				// Fallback to display_image_url (often a thumbnail) if no full-resolution image was successfully processed.
				if (!finalImageUrl && nft.display_image_url) {
					const displayImageResult = await handleMediaUpload(nft.display_image_url, nft);
					if (displayImageResult?.url) {
						finalImageUrl = displayImageResult.url;
						console.log(`[OS_IMPORT] Display image upload successful: ${finalImageUrl}`);

						// Update mime type from display image only if current is generic or text/html.
						if (displayImageResult.fileType?.startsWith('image/')) {
							if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
								finalMime = displayImageResult.fileType;
							}
						} else if (displayImageResult.fileType && isMimeEffectivelyGeneric(finalMime)) {
							finalMime = displayImageResult.fileType;
						}

						// Update dimensions from display image upload if no dimensions yet
						if (displayImageResult.dimensions && !finalDimensions) {
							finalDimensions = displayImageResult.dimensions;
						}
					} else {
						console.warn(`[OS_IMPORT] Display image upload failed for: ${nft.display_image_url}`);
					}
				}

				// If mime is still generic, but we have a generator or animation URL that hints at HTML/JS, set it.
				if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'application/octet-stream') {
					const interactiveUrl = finalGeneratorUrl || finalAnimationUrl;
					if (
						interactiveUrl &&
						(interactiveUrl.includes('fxhash') ||
							interactiveUrl.includes('artblocks') ||
							interactiveUrl.endsWith('.html') ||
							interactiveUrl.endsWith('.htm'))
					) {
						if (finalMime !== 'text/html') {
							finalMime = 'text/html';
						}
					}
				}

				// Try to get dimensions from metadata if we still don't have them
				if (!finalDimensions) {
					if (nft.metadata?.image_details?.width && nft.metadata?.image_details?.height) {
						finalDimensions = {
							width: nft.metadata.image_details.width,
							height: nft.metadata.image_details.height
						};
					} else if (
						nft.metadata?.animation_details?.width &&
						nft.metadata?.animation_details?.height
					) {
						finalDimensions = {
							width: nft.metadata.animation_details.width,
							height: nft.metadata.animation_details.height
						};
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

			console.log('[Final Metadata Before Save]', finalMetadata);

			// Save artwork with validated data
			const artwork = await saveArtwork(
				{
					...nft,
					metadata: finalMetadata,
					mime: finalMime,
					dimensions: finalDimensions,
					tokenID: nft.identifier || nft.tokenId || nft.tokenID,
					generator_url: finalGeneratorUrl
				},
				artist?.id || null,
				collection.id
			);

			// Only create artist relationships if we have an artist
			if (artist) {
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
			}

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
