import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/prisma';
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
		// Use the indexed creator format directly
		creatorData = {
			address: nftData.creator.address,
			username: nftData.creator.username,
			bio: nftData.creator.bio,
			description: nftData.creator.description,
			avatarUrl: nftData.creator.avatarUrl,
			profileUrl: nftData.creator.profileUrl,
			websiteUrl: nftData.creator.websiteUrl,
			displayName: nftData.creator.displayName,
			ensName: nftData.creator.ensName,
			isVerified: nftData.creator.isVerified,
			twitterHandle: nftData.creator.twitterHandle,
			instagramHandle: nftData.creator.instagramHandle,
			profileData: nftData.creator.profileData,
			resolutionSource: nftData.creator.resolutionSource,
			socialLinks: nftData.creator.socialLinks
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
			description: collection.description,
			websiteUrl: collection.websiteUrl || collection.website,
			projectUrl: collection.projectUrl,
			mediumUrl: collection.mediumUrl,
			contractAddress: contractAddress,
			imageUrl: collection.imageUrl || collection.logo || collection.bannerImageUrl,
			bannerImageUrl: collection.bannerImageUrl,
			discordUrl: collection.discordUrl,
			telegramUrl: collection.telegramUrl,
			chainIdentifier: collection.chainIdentifier,
			contractAddresses: collection.contractAddresses,
			safelistStatus: collection.safelistStatus,
			fees: collection.fees,
			artBlocksProjectId: collection.artBlocksProjectId,
			fxhashProjectId: collection.fxhashProjectId,
			projectNumber: collection.projectNumber,
			collectionCreator: collection.collectionCreator,
			curatorAddress: collection.curatorAddress,
			parentContract: collection.parentContract,
			totalSupply: collection.totalSupply,
			currentSupply: collection.currentSupply,
			mintStartDate: collection.mintStartDate,
			mintEndDate: collection.mintEndDate,
			floorPrice: collection.floorPrice,
			volumeTraded: collection.volumeTraded,
			externalCollectionId: collection.externalCollectionId,
			isGenerativeArt: collection.isGenerativeArt || nftData.isGenerativeArt || false,
			isSharedContract: collection.isSharedContract || false
		};
	}
	
	// Transform the data to the normalized IndexerData format
	const data: IndexerData = {
		title: nftData.title || nftData.name || 'Untitled',
		description: nftData.description,
		imageUrl: nftData.imageUrl || nftData.image_url,
		animationUrl: nftData.animationUrl || nftData.animation_url,
		thumbnailUrl: nftData.thumbnailUrl || nftData.display_image_url,
		metadataUrl: nftData.metadataUrl || nftData.metadata_url,
		mime: nftData.mime || nftData.mimeType,
		isGenerativeArt: nftData.isGenerativeArt || false,
		blockchain: nftData.blockchain || blockchain,
		tokenStandard: nftData.tokenStandard || nftData.token_standard || (blockchain === 'tezos' ? 'FA2' : 'ERC721'),
		supply: nftData.supply,
		mintDate: nftData.mintDate,
		dimensions: nftData.dimensions,
		attributes: nftData.attributes || nftData.traits,
		features: nftData.features || nftData.metadata?.features,
		creator: creatorData,
		collection: collectionData
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
		const indexer = new UnifiedIndexer(prisma);
		
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