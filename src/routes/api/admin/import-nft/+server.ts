import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { prismaWrite } from '$lib/prisma';
import { UnifiedIndexer, type IndexerData } from '$lib/indexing/unified-indexer';
import type { DataSource, Blockchain } from '$lib/types/indexing';
import { detectBlockchainFromContract } from '$lib/utils/walletUtils.js';

// Helper function to normalize NFT data from various formats
function normalizeNFTData(nftData: any): { 
	data: IndexerData; 
	contractAddress: string; 
	tokenId: string; 
	source: DataSource; 
} {
	// Determine the source and blockchain from the NFT data
	let source: DataSource = 'opensea';
	
	// Check if it's a Tezos NFT based on contract address
	const contractAddress = nftData.contractAddress || nftData.contractAddr || nftData.collection?.contract;
	const blockchain = contractAddress ? detectBlockchainFromContract(contractAddress) : 'ethereum';
	
	if (blockchain === 'tezos') {
		source = 'objkt';
	}
	
	// Enhanced creator data extraction - only indexed creator object format
	let creatorData: IndexerData['creator'] = undefined;
	
	if (nftData.creator && typeof nftData.creator === 'object') {
		// Use the indexed creator format directly, filtering out undefined values
		const creator = nftData.creator;
		creatorData = {
			address: creator.address,
			...(creator.username !== undefined && { username: creator.username }),
			...(creator.bio !== undefined && { bio: creator.bio }),
			...(creator.description !== undefined && { description: creator.description }),
			...(creator.avatarUrl !== undefined && { avatarUrl: creator.avatarUrl }),
			...(creator.profileUrl !== undefined && { profileUrl: creator.profileUrl }),
			...(creator.websiteUrl !== undefined && { websiteUrl: creator.websiteUrl }),
			...(creator.displayName !== undefined && { displayName: creator.displayName }),
			...(creator.ensName !== undefined && { ensName: creator.ensName }),
			...(creator.isVerified !== undefined && { isVerified: creator.isVerified }),
			...(creator.twitterHandle !== undefined && { twitterHandle: creator.twitterHandle }),
			...(creator.instagramHandle !== undefined && { instagramHandle: creator.instagramHandle }),
			...(creator.profileData !== undefined && { profileData: creator.profileData }),
			...(creator.resolutionSource !== undefined && { resolutionSource: creator.resolutionSource }),
			...(creator.socialLinks !== undefined && { socialLinks: creator.socialLinks })
		};
	}

	// Enhanced collection data extraction
	let collectionData: IndexerData['collection'] = undefined;
	
	if (nftData.collection) {
		// Handle both simple and rich collection data structures
		const collection = nftData.collection;
		
		collectionData = {
			slug: collection.slug || (collection.name || collection.title || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
			title: collection.title || collection.name,
			...(collection.description !== undefined && { description: collection.description }),
			...(collection.websiteUrl !== undefined && { websiteUrl: collection.websiteUrl }),
			...(collection.website !== undefined && { websiteUrl: collection.website }),
			...(collection.projectUrl !== undefined && { projectUrl: collection.projectUrl }),
			...(collection.mediumUrl !== undefined && { mediumUrl: collection.mediumUrl }),
			contractAddress: contractAddress,
			...(collection.imageUrl !== undefined && { imageUrl: collection.imageUrl }),
			...(collection.logo !== undefined && { imageUrl: collection.logo }),
			...(collection.bannerImageUrl !== undefined && { bannerImageUrl: collection.bannerImageUrl }),
			...(collection.discordUrl !== undefined && { discordUrl: collection.discordUrl }),
			...(collection.telegramUrl !== undefined && { telegramUrl: collection.telegramUrl }),
			...(collection.chainIdentifier !== undefined && { chainIdentifier: collection.chainIdentifier }),
			...(collection.contractAddresses !== undefined && { contractAddresses: collection.contractAddresses }),
			...(collection.safelistStatus !== undefined && { safelistStatus: collection.safelistStatus }),
			...(collection.fees !== undefined && { fees: collection.fees }),
			...(collection.artBlocksProjectId !== undefined && { artBlocksProjectId: collection.artBlocksProjectId }),
			...(collection.fxhashProjectId !== undefined && { fxhashProjectId: collection.fxhashProjectId }),
			...(collection.projectNumber !== undefined && { projectNumber: collection.projectNumber }),
			...(collection.collectionCreator !== undefined && { collectionCreator: collection.collectionCreator }),
			...(collection.curatorAddress !== undefined && { curatorAddress: collection.curatorAddress }),
			...(collection.parentContract !== undefined && { parentContract: collection.parentContract }),
			...(collection.totalSupply !== undefined && { totalSupply: collection.totalSupply }),
			...(collection.currentSupply !== undefined && { currentSupply: collection.currentSupply }),
			...(collection.mintStartDate !== undefined && { mintStartDate: collection.mintStartDate }),
			...(collection.mintEndDate !== undefined && { mintEndDate: collection.mintEndDate }),
			...(collection.floorPrice !== undefined && { floorPrice: collection.floorPrice }),
			...(collection.volumeTraded !== undefined && { volumeTraded: collection.volumeTraded }),
			...(collection.externalCollectionId !== undefined && { externalCollectionId: collection.externalCollectionId }),
			isGenerativeArt: collection.isGenerativeArt || nftData.isGenerativeArt || false,
			isSharedContract: collection.isSharedContract || false
		};
	}
	
	// Transform the data to the normalized IndexerData format, filtering out undefined values
	const data: IndexerData = {
		title: nftData.title || nftData.name || 'Untitled',
		...(nftData.description !== undefined && { description: nftData.description }),
		...(nftData.imageUrl !== undefined && { imageUrl: nftData.imageUrl }),
		...(nftData.display_image_url !== undefined && !nftData.imageUrl && { imageUrl: nftData.display_image_url }),
		...(nftData.image_url !== undefined && !nftData.imageUrl && !nftData.display_image_url && { imageUrl: nftData.image_url }),
		...(nftData.animationUrl !== undefined && { animationUrl: nftData.animationUrl }),
		...(nftData.animation_url !== undefined && !nftData.animationUrl && { animationUrl: nftData.animation_url }),
		...(nftData.thumbnailUrl !== undefined && { thumbnailUrl: nftData.thumbnailUrl }),
		...(!nftData.thumbnailUrl && nftData.image_url !== undefined && { thumbnailUrl: nftData.image_url }),
		...(!nftData.thumbnailUrl && !nftData.image_url && nftData.display_image_url !== undefined && { thumbnailUrl: nftData.display_image_url }),
		...(nftData.metadataUrl !== undefined && { metadataUrl: nftData.metadataUrl }),
		...(nftData.metadata_url !== undefined && !nftData.metadataUrl && { metadataUrl: nftData.metadata_url }),
		...(nftData.mime !== undefined && { mime: nftData.mime }),
		...(nftData.mimeType !== undefined && !nftData.mime && { mime: nftData.mimeType }),
		isGenerativeArt: nftData.isGenerativeArt || false,
		blockchain: nftData.blockchain || blockchain,
		tokenStandard: nftData.tokenStandard || nftData.token_standard || (blockchain === 'tezos' ? 'FA2' : 'ERC721'),
		...(nftData.supply !== undefined && { supply: nftData.supply }),
		...(nftData.mintDate !== undefined && { mintDate: nftData.mintDate }),
		...(nftData.dimensions !== undefined && { dimensions: nftData.dimensions }),
		...(nftData.attributes !== undefined && { attributes: nftData.attributes }),
		...(nftData.traits !== undefined && !nftData.attributes && { attributes: nftData.traits }),
		...(nftData.features !== undefined && { features: nftData.features }),
		...(nftData.metadata?.features !== undefined && !nftData.features && { features: nftData.metadata.features }),
		...(creatorData !== undefined && { creator: creatorData }),
		...(collectionData !== undefined && { collection: collectionData })
	};
	
	const tokenId = nftData.tokenId || nftData.tokenID || nftData.id;
	
	return {
		data,
		contractAddress,
		tokenId,
		source: (nftData.source as DataSource) || source
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		
		// Debug logging
		console.log('[import-nft] Received request body:', JSON.stringify(body, null, 2));
		
		// Initialize the unified indexer
		const indexer = new UnifiedIndexer(prismaWrite);
		
		// Handle both single NFT and bulk import formats
		let nftsToProcess: any[] = [];
		let isBulkImport = false;
		
		if (body.nfts && Array.isArray(body.nfts)) {
			// Bulk import format: { nfts: [...], source?: string }
			nftsToProcess = body.nfts;
			isBulkImport = true;
		} else if (body.contractAddress || body.contractAddr || body.tokenId || body.tokenID || body.id) {
			// Single NFT format: direct NFT data object
			nftsToProcess = [body];
		} else {
			return json({ error: 'Invalid request format. Expected either single NFT data or { nfts: [...] }' }, { status: 400 });
		}
		
		console.log(`[import-nft] Processing ${nftsToProcess.length} NFTs, bulk import: ${isBulkImport}`);
		
		// Process NFTs
		const indexResults: Array<{
			success: boolean;
			indexId?: number;
			nftUid?: string;
			error?: string;
			artworkId?: number;
			artistId?: number;
			collectionId?: number;
		}> = [];
		
		for (const nftData of nftsToProcess) {
			try {
				console.log('[import-nft] Processing NFT:', {
					contractAddress: nftData.contractAddress || nftData.contractAddr,
					tokenId: nftData.tokenId || nftData.tokenID || nftData.id,
					hasCreator: !!nftData.creator,
					creatorAddress: nftData.creator?.address
				});
				
				// Handle different data formats
				let data: IndexerData;
				let contractAddress: string;
				let tokenId: string;
				let source: DataSource;
				
				if (isBulkImport) {
					// Bulk import expects pre-normalized data
					data = nftData;
					contractAddress = nftData.contractAddress;
					tokenId = nftData.tokenId;
					source = (nftData.source as DataSource) || (body.source as DataSource) || 'manual';
				} else {
					// Single import needs normalization
					const normalized = normalizeNFTData(nftData);
					data = normalized.data;
					contractAddress = normalized.contractAddress;
					tokenId = normalized.tokenId;
					source = normalized.source;
					
					console.log('[import-nft] Normalized data:', {
						hasCreator: !!data.creator,
						creatorAddress: data.creator?.address,
						creatorUsername: data.creator?.username
					});
				}
				
				// Validate required fields
				if (!contractAddress || !tokenId) {
					throw new Error('contractAddress and tokenId are required');
				}
				
				// Index the normalized data
				const { indexId, nftUid } = await indexer.indexNFT(
					data,
					source,
					data.blockchain as Blockchain,
					contractAddress,
					tokenId
				);
				
				console.log(`[import-nft] Indexed NFT ${nftUid} with index ID: ${indexId}`);
				
				// For single imports, process immediately
				if (!isBulkImport) {
					const importResult = await indexer.processIndexedData(indexId);
					
					console.log('[import-nft] Import result:', {
						success: importResult.success,
						artworkId: importResult.artworkId,
						artistId: importResult.artistId,
						collectionId: importResult.collectionId,
						errors: importResult.errors
					});
					
					if (!importResult.success) {
						throw new Error(`Import failed: ${importResult.errors?.join(', ') || 'Unknown error'}`);
					}
					
					indexResults.push({
						success: true,
						indexId,
						nftUid,
						artworkId: importResult.artworkId,
						artistId: importResult.artistId,
						collectionId: importResult.collectionId
					});
				} else {
					indexResults.push({
						success: true,
						indexId,
						nftUid
					});
				}
			} catch (error) {
				console.error('[import-nft] Error processing NFT:', error);
				indexResults.push({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		// For bulk imports, process the queue
		if (isBulkImport) {
			const processResults = await indexer.processQueue('pending', indexResults.filter(r => r.success).length);
			
			// Merge process results with index results
			processResults.forEach((processResult, index) => {
				const indexResult = indexResults.find(r => r.success);
				if (indexResult && processResult.success) {
					indexResult.artworkId = processResult.artworkId;
					indexResult.artistId = processResult.artistId;
					indexResult.collectionId = processResult.collectionId;
				}
			});
		}

		const successful = indexResults.filter(r => r.success).length;
		const failed = indexResults.filter(r => !r.success).length;

		// Return appropriate response format
		if (!isBulkImport && indexResults.length === 1) {
			// Single import response
			const result = indexResults[0];
			if (result.success) {
				return json({
					success: true,
					indexId: result.indexId,
					nftUid: result.nftUid,
					artworkId: result.artworkId,
					artistId: result.artistId,
					collectionId: result.collectionId
				});
			} else {
				return json({
					success: false,
					error: result.error
				}, { status: 500 });
			}
		} else {
			// Bulk import response
			return json({ 
				success: true, 
				imported: successful,
				failed: failed,
				total: nftsToProcess.length,
				details: indexResults.map(r => ({
					success: r.success,
					nftUid: r.success ? r.nftUid : undefined,
					artworkId: r.artworkId,
					artistId: r.artistId,
					collectionId: r.collectionId,
					error: r.success ? undefined : r.error
				}))
			});
		}

	} catch (error) {
		console.error('[import-nft] Fatal error:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}; 