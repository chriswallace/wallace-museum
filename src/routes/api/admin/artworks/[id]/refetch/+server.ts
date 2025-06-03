import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/prisma';
import { MinimalIndexingWorkflow } from '$lib/minimal-api-helpers';
import { detectBlockchainFromContract } from '$lib/utils/walletUtils';
import { OPENSEA_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;
	
	if (!id) {
		return json({ error: 'Artwork ID is required' }, { status: 400 });
	}
	
	const artworkId = parseInt(id, 10);

	try {
		// First, fetch the current artwork to get contract address and token ID
		const artwork = await prisma.artwork.findUnique({
			where: { id: artworkId },
			select: {
				id: true,
				title: true,
				contractAddress: true,
				tokenId: true,
				blockchain: true
			}
		});

		if (!artwork) {
			return json({ error: 'Artwork not found' }, { status: 404 });
		}

		if (!artwork.contractAddress || !artwork.tokenId) {
			return json({ 
				error: 'Artwork missing contract address or token ID - cannot refetch data' 
			}, { status: 400 });
		}

		// Determine blockchain if not set
		const blockchain = artwork.blockchain || detectBlockchainFromContract(artwork.contractAddress);
		
		if (!blockchain || (blockchain !== 'ethereum' && blockchain !== 'tezos')) {
			return json({ 
				error: 'Unsupported blockchain or unable to detect blockchain from contract address' 
			}, { status: 400 });
		}

		// Check if we have API key for Ethereum requests
		if (blockchain === 'ethereum' && !OPENSEA_API_KEY) {
			return json({ 
				error: 'OpenSea API key not configured - cannot refetch Ethereum NFT data' 
			}, { status: 500 });
		}

		console.log(`[refetch] Refetching data for artwork ${artworkId}: ${artwork.contractAddress}:${artwork.tokenId} on ${blockchain}`);

		// Initialize the indexing workflow to fetch fresh data
		const workflow = new MinimalIndexingWorkflow(OPENSEA_API_KEY!);
		
		// Fetch fresh NFT data from external APIs
		const freshNftData = await workflow.getNFTData(
			artwork.contractAddress,
			artwork.tokenId,
			blockchain as 'ethereum' | 'tezos'
		);

		if (!freshNftData) {
			return json({ 
				error: 'Could not fetch fresh data from external API - NFT may not exist or API may be unavailable' 
			}, { status: 404 });
		}

		console.log(`[refetch] Successfully fetched fresh data for ${artwork.contractAddress}:${artwork.tokenId}`);

		// Prepare update data from fresh NFT data
		const updateData: any = {};

		// Update basic fields
		if (freshNftData.title && freshNftData.title !== artwork.title) {
			updateData.title = freshNftData.title;
		}
		if (freshNftData.description) {
			updateData.description = freshNftData.description;
		}

		// Update media URLs
		if (freshNftData.imageUrl) {
			updateData.imageUrl = freshNftData.imageUrl;
		}
		if (freshNftData.animationUrl) {
			updateData.animationUrl = freshNftData.animationUrl;
		}
		if (freshNftData.thumbnailUrl) {
			updateData.thumbnailUrl = freshNftData.thumbnailUrl;
		}
		if (freshNftData.generatorUrl) {
			updateData.generatorUrl = freshNftData.generatorUrl;
		}

		// Update metadata
		if (freshNftData.metadataUrl) {
			updateData.metadataUrl = freshNftData.metadataUrl;
		}

		// Update technical fields
		if (freshNftData.mime) {
			updateData.mime = freshNftData.mime;
		}
		if (freshNftData.dimensions) {
			updateData.dimensions = freshNftData.dimensions;
		}
		if (freshNftData.supply) {
			updateData.supply = freshNftData.supply;
		}

		// Update attributes if available
		if (freshNftData.attributes) {
			updateData.attributes = freshNftData.attributes;
		}

		// Update features if available
		if (freshNftData.features) {
			updateData.features = freshNftData.features;
		}

		// Update mint date if available
		if (freshNftData.mintDate) {
			updateData.mintDate = new Date(freshNftData.mintDate);
		}

		// Update blockchain and token standard
		if (blockchain) {
			updateData.blockchain = blockchain;
		}
		if (freshNftData.tokenStandard) {
			updateData.tokenStandard = freshNftData.tokenStandard;
		}

		// Only update if we have changes
		if (Object.keys(updateData).length === 0) {
			return json({ 
				success: true, 
				message: 'No changes detected - artwork is already up to date',
				artwork: artwork
			});
		}

		console.log(`[refetch] Updating artwork ${artworkId} with ${Object.keys(updateData).length} fields:`, Object.keys(updateData));

		// Update the artwork in the database
		const updatedArtwork = await prisma.artwork.update({
			where: { id: artworkId },
			data: updateData,
			include: {
				collection: true,
				artists: true
			}
		});

		// Pin any new IPFS URLs to Pinata
		try {
			const artworkForPinning = {
				title: updatedArtwork.title,
				imageUrl: updatedArtwork.imageUrl,
				thumbnailUrl: updatedArtwork.thumbnailUrl,
				animationUrl: updatedArtwork.animationUrl,
				metadataUrl: updatedArtwork.metadataUrl
			};
			
			const { extractCidsFromArtwork, pinCidToPinata } = await import('$lib/pinataHelpers');
			const cids = extractCidsFromArtwork(artworkForPinning);
			if (cids.length > 0) {
				console.log(`[refetch] Pinning ${cids.length} IPFS URLs for refetched artwork: ${updatedArtwork.title}`);
				
				for (const cid of cids) {
					try {
						const pinName = `${updatedArtwork.title} - ${cid}`;
						await pinCidToPinata(cid, pinName);
						console.log(`[refetch] Successfully pinned CID: ${cid} for artwork: ${updatedArtwork.title}`);
					} catch (pinError) {
						console.error(`[refetch] Failed to pin CID ${cid} for artwork ${updatedArtwork.title}:`, pinError);
						// Continue with other CIDs even if one fails
					}
				}
			}
		} catch (pinningError) {
			console.error(`[refetch] Error during Pinata pinning for refetched artwork ${updatedArtwork.title}:`, pinningError);
			// Don't fail the refetch if pinning fails
		}

		// Transform for consistent response with GET
		const transformedResponse = {
			...updatedArtwork,
			tokenID: updatedArtwork.tokenId,
			contractAddr: updatedArtwork.contractAddress,
			artists: updatedArtwork.artists || [],
			artist: updatedArtwork.artists && updatedArtwork.artists.length > 0 ? updatedArtwork.artists[0] : null
		};

		return json({
			success: true,
			message: `Successfully refetched and updated artwork data`,
			updatedFields: Object.keys(updateData),
			artwork: transformedResponse
		});

	} catch (error) {
		console.error(`[refetch] Error refetching artwork ${artworkId}:`, error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred while refetching artwork data'
		}, { status: 500 });
	}
}; 