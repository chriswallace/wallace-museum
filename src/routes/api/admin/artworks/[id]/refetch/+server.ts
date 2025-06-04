import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/prisma';
import { MinimalIndexingWorkflow } from '$lib/minimal-api-helpers';
import { EnhancedFieldProcessor } from '$lib/enhanced-field-processor';
import { MediaAnalyzer } from '$lib/utils/mediaAnalyzer.js';
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
		console.log(`[refetch] About to call workflow.getNFTData with contract: ${artwork.contractAddress}, tokenId: ${artwork.tokenId}, blockchain: ${blockchain}`);
		
		let freshNftData;
		try {
			freshNftData = await workflow.getNFTData(
			artwork.contractAddress,
			artwork.tokenId,
			blockchain as 'ethereum' | 'tezos'
		);
			console.log(`[refetch] workflow.getNFTData completed successfully`);
		} catch (error) {
			console.error(`[refetch] Error during workflow.getNFTData call:`, error);
			return json({ 
				error: `Error fetching NFT data: ${error instanceof Error ? error.message : 'Unknown error'}` 
			}, { status: 500 });
		}
		
		console.log(`[refetch] workflow.getNFTData returned:`, freshNftData);

		if (!freshNftData) {
			console.log(`[refetch] No fresh data returned from external API for ${artwork.contractAddress}:${artwork.tokenId}`);
			return json({ 
				error: 'Could not fetch fresh data from external API - NFT may not exist or API may be unavailable' 
			}, { status: 404 });
		}

		console.log(`[refetch] Successfully fetched fresh data for ${artwork.contractAddress}:${artwork.tokenId}`);

		// Use our enhanced field processor and media analyzer for better data processing
		const fieldProcessor = new EnhancedFieldProcessor();
		
		// Process the raw data with enhanced field extraction
		const enhancedData = await fieldProcessor.processArtworkFields(freshNftData, blockchain);
		
		// Use MediaAnalyzer for more reliable URL and MIME type detection
		const mediaUrlSet = await MediaAnalyzer.analyzeUrlSet(freshNftData, blockchain);
		
		// Merge the enhanced data with media analysis results
		const processedData = {
			...enhancedData,
			...mediaUrlSet, // This will override URLs with better analyzed ones
			title: enhancedData.title || freshNftData.title || artwork.title,
			description: enhancedData.description || freshNftData.description,
			tokenStandard: enhancedData.tokenStandard || freshNftData.tokenStandard,
			blockchain: blockchain,
			contractAddress: artwork.contractAddress,
			tokenId: artwork.tokenId
		};

		console.log(`[refetch] Enhanced data processing complete for ${artwork.contractAddress}:${artwork.tokenId}`);
		console.log(`[refetch] Media URLs - Image: ${mediaUrlSet.imageUrl ? 'found' : 'none'}, Animation: ${mediaUrlSet.animationUrl ? 'found' : 'none'}, Generator: ${mediaUrlSet.generatorUrl ? 'found' : 'none'}`);
		console.log(`[refetch] Primary MIME type: ${mediaUrlSet.primaryMime || 'not detected'}`);

		// Prepare update data from processed NFT data
		const updateData: any = {};

		// Update basic fields
		if (processedData.title && processedData.title !== artwork.title) {
			updateData.title = processedData.title;
		}
		if (processedData.description) {
			updateData.description = processedData.description;
		}

		// Update media URLs with enhanced analysis results
		if (processedData.imageUrl) {
			updateData.imageUrl = processedData.imageUrl;
		}
		if (processedData.animationUrl) {
			updateData.animationUrl = processedData.animationUrl;
		}
		if (processedData.thumbnailUrl) {
			updateData.thumbnailUrl = processedData.thumbnailUrl;
		}
		if (processedData.generatorUrl) {
			updateData.generatorUrl = processedData.generatorUrl;
		}

		// Update metadata
		if (processedData.metadataUrl) {
			updateData.metadataUrl = processedData.metadataUrl;
		}

		// Update technical fields with enhanced MIME detection
		if (processedData.primaryMime) {
			updateData.mime = processedData.primaryMime;
		}
		if (processedData.dimensions) {
			updateData.dimensions = processedData.dimensions;
		}
		if (processedData.supply) {
			updateData.supply = processedData.supply;
		}

		// Update attributes if available
		if (processedData.attributes) {
			updateData.attributes = processedData.attributes;
		}

		// Update features if available
		if (processedData.features) {
			updateData.features = processedData.features;
		}

		// Update mint date if available
		if (processedData.mintDate) {
			updateData.mintDate = new Date(processedData.mintDate);
		}

		// Update blockchain and token standard
		if (blockchain) {
			updateData.blockchain = blockchain;
		}
		if (processedData.tokenStandard) {
			updateData.tokenStandard = processedData.tokenStandard;
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
				Collection: true,
				Artist: true
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
			artists: updatedArtwork.Artist || [],
			artist: updatedArtwork.Artist && updatedArtwork.Artist.length > 0 ? updatedArtwork.Artist[0] : null
		};

		return json({
			success: true,
			message: `Successfully refetched and updated artwork data with enhanced media analysis`,
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