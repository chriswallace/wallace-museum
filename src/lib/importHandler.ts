import {
	nfts,
	isLoading,
	updatedNfts,
	reviewData,
	nftImportQueue,
	selectedNfts,
	importProgress,
	currentStep,
	walletAddress,
	type Artwork
} from '$lib/stores';
import { toast } from '@zerodevx/svelte-toast';
import { get } from 'svelte/store';
import ImportStatus from '$lib/components/ImportStatus.svelte';
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { openModal, closeModal } from '$lib/modal';
import { detectMimeType } from '$lib/utils';
import { detectBlockchainFromContract } from '$lib/utils/walletUtils.js';

const totalSteps = 3;

interface Collection {
	name: string;
	description: string;
	contract: string;
	collection?: string;
	title?: string;
	slug?: string;
	websiteUrl?: string;
	imageUrl?: string;
	discordUrl?: string;
	telegramUrl?: string;
	contractAddresses?: any;
}

interface ImportNft {
	id: string | number;
	title: string;
	name: string;
	description: string;
	image_url?: string;
	animation_url?: string;
	mime?: string;
	contractAddr?: string;
	contractAlias?: string;
	tokenID?: string;
	token_id?: string;
	symbol?: string;
	supply?: number | string;
	
	// Mint date fields
	mintDate?: string | Date;
	mint_date?: string | Date;
	timestamp?: string | Date;
	created_date?: string | Date;
	created_at?: string | Date;
	
	// Additional image/media fields
	display_image_url?: string;
	display_animation_url?: string;
	thumbnailUrl?: string;
	thumbnail_url?: string;
	imageUrl?: string;
	animationUrl?: string;
	generatorUrl?: string;
	generator_url?: string;
	metadataUrl?: string;
	metadata_url?: string;
	
	// Token details
	tokenStandard?: string;
	token_standard?: string;
	dimensions?: { width: number; height: number };
	features?: Record<string, any>;
	
	creator?: {
		address: string;
		username?: string;
		bio?: string;
		description?: string;
		avatarUrl?: string;
		profileUrl?: string;
		websiteUrl?: string;
		displayName?: string;
		ensName?: string;
		isVerified?: boolean;
		twitterHandle?: string;
		instagramHandle?: string;
		profileData?: Record<string, any>;
		resolutionSource?: string;
		socialLinks?: {
			twitter?: string;
			instagram?: string;
			discord?: string;
			website?: string;
		};
	};
	identifier?: string | number;
	contractAddress?: string;
	tokenId?: string;
	metadata?: {
		image_url?: string;
		animation_url?: string;
		attributes?: any[];
		symbol?: string;
		supply?: number | string;
		mint_date?: string | Date;
		timestamp?: string | Date;
		[key: string]: any;
	};
	collection?: {
		name: string;
		contract?: string;
		blockchain: string;
		title?: string;
		description?: string;
		websiteUrl?: string;
		imageUrl?: string;
		discordUrl?: string;
		telegramUrl?: string;
		slug?: string;
		isGenerativeArt?: boolean;
		isSharedContract?: boolean;
	};
	attributes?: any[];
}

interface ImportProgress {
	id: string | number;
	name: string;
	status: string;
}

interface ApiResponse {
	collection: Collection;
}

export function nextStep() {
	currentStep.update((step) => {
		if (step === 1) {
			return 2;
		}
		return step;
	});
}

export function showImportToast() {
	toast.push('Importing', {
		component: { src: ImportStatus },
		initial: 0,
		dismissable: false,
		theme: {
			'--toastBackground': '#fff',
			'--toastColor': '#444'
		}
	});
}

export function hideImportToast() {
	setInterval(() => {
		toast.pop();
	}, 2000);
}

export function updateProgress(status: string, index: number) {
	importProgress.update((progress) => {
		if (index !== -1) {
			const updatedItem = { ...progress[index], status: status };
			const updatedProgress = [
				...progress.slice(0, index),
				updatedItem,
				...progress.slice(index + 1)
			];
			if (browser) {
				localStorage.setItem('importProgress', JSON.stringify(updatedProgress));
			}
			return updatedProgress;
		}
		return progress;
	});
}

export async function finalizeImport(artworksToImport?: Artwork[]) {
	// Use provided artworks or get from store
	const updatedNftsArray = artworksToImport || get(updatedNfts);

	nftImportQueue.set(updatedNftsArray);
	if (browser) {
		localStorage.setItem('nftImportQueue', JSON.stringify(updatedNftsArray));
	}

	// Initialize progress tracking for each NFT
	const importProgressInit = updatedNftsArray.map((nft) => ({
		id: nft.id,
		name: nft.title || 'Untitled',
		status: 'loading'
	}));

	importProgress.set(importProgressInit);
	if (browser) {
		localStorage.setItem('importProgress', JSON.stringify(importProgressInit));
	}

	// Start the import process immediately
	await startImportProcess();
}

// Utility to validate blockchain addresses (Ethereum/Tezos)
function isValidAddress(address: string | undefined | null): boolean {
	if (!address) return false;
	if (address === '-') return false;
	if (address === '0x0000000000000000000000000000000000000000') return false;
	if (address.length < 20) return false;
	return true;
}

// Helper to detect shared contracts
function isSharedContract(contractAddress: string, blockchain: string): boolean {
	const normalizedAddress = contractAddress.toLowerCase();

	const sharedContracts = {
		ethereum: [
			// OpenSea
			'0x495f947276749ce646f68ac8c248420045cb7b5e', // OpenSea Shared Storefront
			'0xa5409ec958c83c3f309868babaca7c86dcb077c1', // OpenSea Collections
			'0x2953399124f0cbb46d2cbacd8a89cf0599974963', // OpenSea Collections v2

			// Rarible
			'0xd07dc4262bcdbf85190c01c996b4c06a461d2430', // Rarible ERC-721
			'0xb66a603f4cfe17e3d27b87a8bfcad319856518b8', // Rarible ERC-1155
			'0x6ede7f3c26975aad32a475e1021d8f6f39c89d82', // Rarible Custom

			// Zora
			'0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7', // Zora Media
			'0x7c2668bd0d3c050703cecc956c11bd520c26f7d4', // Zora Editions

			// Foundation
			'0x3b3ee1931dc30c1957379fac9aba94d1c48a5405', // Foundation
			'0x2d9ea78ddc5f14b2ee4f8e4c2b3a3f2e1e09f7e3', // Foundation World

			// SuperRare
			'0xb932a70a57673d89f4acffbe830e8ed7f75fb9e0', // SuperRare
			'0x41a322b28d0ff354040e2cbc676f0320d8c8850d', // SuperRare v2

			// Manifold
			'0xe4e4003afe3765aca8149a82fc064c0b125b9e5a', // Manifold Creator Core
			'0x6b8dc2ae5aba7873f8c617e625e39c1b4b47dc9f', // Manifold Gallery

			// Async Art
			'0xb6dae651468e9593e4581705a09c10a76ac1e0c8', // Async Art
			'0xa5c0bd78d1667c13bfb403e2a3336871396713c5', // Async Music

			// Known Music
			'0x2216d47494e516d8206b70fca8585820ed3c4946', // Sound.xyz
			'0x8b5f6f5b4a6f3d8f2b8d3c2c9a1b4c3f1f2d3e4f', // Catalog

			// Other platforms
			'0xa3aee8bce55beea1951ef834b99f3ac60d1abeeb', // VeeFriends
			'0x76be3b62873462d2142405439777e971754e8e77' // Async Blueprint
		],
		tezos: [
			// hic et nunc
			'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton', // hic et nunc main
			'KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9', // hic et nunc v2

			// Objkt / Teia
			'KT1My1wDZHDGweCrJnQJi3wcFaS67iksirvj', // Teia Community

			// Versum
			'KT1LjmAdYQCLBjwv4S2oFkEzyHVkomAf5MrW', // Versum

			// Kalamint
			'KT1EpGgjQs73QfFJs9z7m1Mxm5MTnpC2tqse', // Kalamint

			// Typed
			'KT1VoZeuBMJF6vxtLqEFMoc4no4VDuu1QVwc', // Typed

			// 8bidou
			'KT1MxDwChiDwd6WBVs24g1NjERUoK622ZEFp', // 8bidou

			// DNA
			'KT1XTKaKBXKJVmhxtLF96mn4WQLqmfGGYuKy' // DNA
		]
	};

	const chainContracts = sharedContracts[blockchain.toLowerCase() as keyof typeof sharedContracts] || [];
	return chainContracts.includes(normalizedAddress);
}

// Helper to detect generative art contracts
function isGenerativeArtContract(contractAddress: string, blockchain: string): boolean {
	const normalizedAddress = contractAddress.toLowerCase();

	const generativeArtContracts = {
		ethereum: [
			// Art Blocks
			'0x059edd72cd353df5106d2b9cc5ab83a52287ac3a', // Art Blocks Curated
			'0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270', // Art Blocks Factory
			'0x99a9b7c1116f9ceeb1652de04d5969cce509b069', // Art Blocks Playground
			'0x0e6a21cf97d6a9d9d8f794d26dfb3e3baa49f3ac' // Art Blocks Presents Flex
		],
		tezos: [
			// fxhash
			'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', // fxhash v1
			'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', // fxhash v2
			'KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk', // fxhash gentk v1
			'KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr' // fxhash gentk v2
		]
	};

	const chainContracts = generativeArtContracts[blockchain.toLowerCase() as keyof typeof generativeArtContracts] || [];
	return chainContracts.includes(normalizedAddress);
}

async function importNft(nft: ImportNft) {
	try {
		const contractAddress = nft.contractAddr || nft.collection?.contract;
		
		// Determine blockchain based on contract address format
		const blockchain = contractAddress ? detectBlockchainFromContract(contractAddress) : 'unknown';
		const source = blockchain === 'tezos' ? 'tezos' : 'opensea';

		// Ensure we have a MIME type for animation_url content
		let mimeType = nft.mime;
		if (!mimeType && nft.animation_url) {
			const detectedMime = detectMimeType(nft.animation_url);
			if (detectedMime) {
				mimeType = detectedMime;
			}
		}

		// Handle creator/artist data - support both 'creator' and 'artist' fields
		let creatorData = nft.creator;
		
		// If no creator but we have artist data (from ExtendedArtwork), map it to creator format
		if (!creatorData && (nft as any).artist) {
			const artistData = (nft as any).artist;
			creatorData = {
				address: artistData.walletAddress || '',
				username: artistData.name || undefined,
				avatarUrl: artistData.avatarUrl || undefined,
				// Add other fields with undefined as defaults since artist has limited data
				bio: undefined,
				description: undefined,
				profileUrl: undefined,
				websiteUrl: undefined,
				displayName: undefined,
				ensName: undefined,
				isVerified: undefined,
				twitterHandle: undefined,
				instagramHandle: undefined,
				profileData: undefined,
				resolutionSource: undefined,
				socialLinks: undefined
			};
		}

		// Validate creator address if present
		if (creatorData?.address && !isValidAddress(creatorData.address)) {
			console.warn(`[importHandler] Invalid creator address: ${creatorData.address}, skipping creator data`);
			creatorData = undefined;
		}

		// Get rich collection data from review data
		const currentReviewData = get(reviewData);
		let collectionInfo = null;
		
		// Find the collection data from review data that matches this NFT's contract
		if (currentReviewData.collections && currentReviewData.collections.length > 0) {
			collectionInfo = currentReviewData.collections.find(col => 
				col.contract === contractAddress || 
				col.slug === contractAddress ||
				(col.contractAddresses && Array.isArray(col.contractAddresses) && 
				 col.contractAddresses.some((addr: any) => addr.address === contractAddress))
			);
		}

		// If no collection found in review data, create minimal collection object
		if (!collectionInfo) {
			collectionInfo = {
				name: nft.collection?.name || nft.contractAlias || 'Unknown Collection',
				contract: contractAddress,
				blockchain: blockchain === 'tezos' ? 'Tezos' : 'Ethereum'
			};
		}

		// Ensure NFT has the required fields and matches schema
		const nftToImport = {
			// Basic identification fields
			contractAddress: nft.contractAddr || nft.collection?.contract,
			tokenId: nft.tokenID || nft.tokenId || nft.id,
			blockchain: blockchain,
			title: nft.title || nft.name || 'Untitled',
			description: nft.description,

			// Enhanced mint date extraction with validation
			mintDate: (() => {
				// Try multiple sources for mint date
				const mintDateSources = [
					nft.mintDate,
					nft.mint_date,
					nft.metadata?.mint_date,
					nft.metadata?.timestamp,
					nft.timestamp,
					nft.created_date,
					nft.created_at
				];

				console.log(`[importHandler] Checking mint date sources for ${contractAddress}:${nft.tokenID || nft.tokenId || nft.id}`);
				console.log('[importHandler] Available date fields:', {
					mintDate: nft.mintDate,
					mint_date: nft.mint_date,
					'metadata.mint_date': nft.metadata?.mint_date,
					'metadata.timestamp': nft.metadata?.timestamp,
					timestamp: nft.timestamp,
					created_date: nft.created_date,
					created_at: nft.created_at
				});

				for (const dateSource of mintDateSources) {
					if (dateSource) {
						try {
							const parsedDate = new Date(dateSource);
							if (!isNaN(parsedDate.getTime())) {
								const isoDate = parsedDate.toISOString();
								console.log(`[importHandler] Successfully parsed mint date: ${isoDate} from source: ${dateSource}`);
								return isoDate;
							}
						} catch (error) {
							console.warn(`[importHandler] Failed to parse mint date: ${dateSource}`, error);
						}
					}
				}
				console.log('[importHandler] No valid mint date found');
				return undefined;
			})(),

			// Media URLs
			imageUrl: nft.image_url || nft.imageUrl || nft.display_image_url,
			thumbnailUrl: nft.thumbnailUrl || nft.thumbnail_url || nft.display_image_url,
			animationUrl: nft.animation_url || nft.animationUrl || nft.display_animation_url,
			generatorUrl: nft.generatorUrl || nft.generator_url,
			metadataUrl: nft.metadataUrl || nft.metadata_url,

			// Token details
			tokenStandard: nft.tokenStandard || nft.token_standard || (blockchain === 'tezos' ? 'FA2' : 'ERC721'),
			mime: mimeType,
			supply: nft.supply,
			symbol: nft.symbol,
			dimensions: nft.dimensions,

			// Attributes and features
			attributes: nft.attributes || [],
			features: nft.features,

			// Creator information (enhanced format) - use the mapped creator data
			creator: creatorData ? {
				address: creatorData.address,
				username: creatorData.username,
				bio: creatorData.bio,
				description: creatorData.description || creatorData.bio,
				avatarUrl: creatorData.avatarUrl,
				profileUrl: creatorData.profileUrl,
				websiteUrl: creatorData.websiteUrl,
				displayName: creatorData.displayName,
				ensName: creatorData.ensName,
				isVerified: creatorData.isVerified,
				twitterHandle: creatorData.twitterHandle,
				instagramHandle: creatorData.instagramHandle,
				profileData: creatorData.profileData,
				resolutionSource: creatorData.resolutionSource,
				socialLinks: creatorData.socialLinks
			} : undefined,

			// Collection information (enhanced format)
			collection: collectionInfo ? {
				slug: collectionInfo.slug || contractAddress,
				title: collectionInfo.name || collectionInfo.title,
				description: collectionInfo.description,
				contractAddress: contractAddress,
				websiteUrl: collectionInfo.websiteUrl,
				projectUrl: collectionInfo.projectUrl,
				mediumUrl: collectionInfo.mediumUrl,
				imageUrl: collectionInfo.imageUrl,
				bannerImageUrl: collectionInfo.bannerImageUrl,
				discordUrl: collectionInfo.discordUrl,
				telegramUrl: collectionInfo.telegramUrl,
				chainIdentifier: collectionInfo.chainIdentifier,
				contractAddresses: collectionInfo.contractAddresses,
				safelistStatus: collectionInfo.safelistStatus,
				fees: collectionInfo.fees,
				artBlocksProjectId: collectionInfo.artBlocksProjectId,
				fxhashProjectId: collectionInfo.fxhashProjectId,
				projectNumber: collectionInfo.projectNumber,
				collectionCreator: collectionInfo.collectionCreator,
				curatorAddress: collectionInfo.curatorAddress,
				parentContract: collectionInfo.parentContract,
				totalSupply: collectionInfo.totalSupply,
				currentSupply: collectionInfo.currentSupply,
				mintStartDate: collectionInfo.mintStartDate,
				mintEndDate: collectionInfo.mintEndDate,
				floorPrice: collectionInfo.floorPrice,
				volumeTraded: collectionInfo.volumeTraded,
				externalCollectionId: collectionInfo.externalCollectionId,
				isGenerativeArt: collectionInfo.isGenerativeArt,
				isSharedContract: collectionInfo.isSharedContract
			} : undefined,

			// Metadata object with all available fields
			metadata: {
				image_url: nft.image_url,
				animation_url: nft.animation_url,
				attributes: nft.attributes || [],
				symbol: nft.symbol,
				supply: nft.supply,
				// Add any other metadata fields that might exist (excluding mint_date to avoid conflicts)
				...Object.fromEntries(
					Object.entries(nft.metadata || {}).filter(([key]) => key !== 'mint_date')
				),
				// Add mint_date last to ensure it takes precedence
				mint_date: nft.mintDate || nft.mint_date || nft.metadata?.mint_date
			}
		};

		// Log creator data for debugging
		if (creatorData) {
			console.log(`[importHandler] Importing NFT ${contractAddress}:${nftToImport.tokenId} with creator: ${creatorData.address} (${creatorData.username || 'unnamed'})`);
		} else {
			console.log(`[importHandler] Importing NFT ${contractAddress}:${nftToImport.tokenId} without creator data`);
		}

		// Use a new endpoint for importing already-processed NFT data
		const response = await fetch('/api/admin/import-nft', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(nftToImport)
		});

		if (!response.ok) {
			let errorMessage = 'Import failed';
			try {
				const errorData = await response.json();
				errorMessage = errorData.error || errorData.message || errorMessage;
				console.error('[importHandler] Server error response:', errorData);
			} catch (e) {
				// If response isn't JSON, try to get text
				try {
					const errorText = await response.text();
					console.error('[importHandler] Server error text:', errorText);
					errorMessage = errorText || `HTTP ${response.status} ${response.statusText}`;
				} catch (textError) {
					console.error('[importHandler] Could not parse error response');
				}
			}
			console.error('[importHandler] Import failed with status:', response.status);
			console.error('[importHandler] Failed NFT data:', nftToImport);
			throw new Error(errorMessage);
		}

		const result = await response.json();

		// Index the artwork if it was successfully imported
		if (result?.artwork?.id) {
		}

		return result;
	} catch (error) {
		throw error;
	}
}

export async function startImportProcess() {
	const nftsToImport = get(nftImportQueue);

	if (!nftsToImport || nftsToImport.length === 0) {
		return;
	}

	showImportToast();

	for (let i = 0; i < nftsToImport.length; i++) {
		const nft = nftsToImport[i];

		updateProgress('loading', i);

		try {
			await importNft(nft);
			updateProgress('complete', i);
		} catch (error) {
			updateProgress('error', i);
		}

		await tick();
	}

	hideImportToast();
	selectedNfts.set(new Map());
}

export function handleCollectionSave(editedCollection: Collection, index: number) {
	reviewData.update((data) => {
		const updatedCollections = [...data.collections];
		updatedCollections[index] = editedCollection;
		return { ...data, collections: updatedCollections };
	});
}

export async function openReviewModal() {
	const wallet = get(walletAddress);

	try {
		if (wallet.startsWith('0x')) {
			await setEthReviewData();
		} else if (wallet.startsWith('tz')) {
			await setTezReviewData();
		}

		if (get(reviewData).collections.length > 0) openModal();
	} finally {
		isLoading.set(false);
	}
}

export async function setTezReviewData() {
	const allNfts = get(nfts);
	const selectedArtworks = Array.from(get(selectedNfts).values());
	const fetchUri = '/api/admin/nft-data/tezos/';

	try {
		// Get unique contract addresses from selected artworks
		const collectionIds = selectedArtworks.map((nft) => nft.contractAddr).filter(Boolean);
		const uniqueCollectionIds = [...new Set(collectionIds)];
		
		if (uniqueCollectionIds.length > 0) {
			// Fetch rich collection data from the API
			const dataRequest = { collections: uniqueCollectionIds };

			const response = await fetch(fetchUri, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(dataRequest)
			});

			if (!response.ok) throw new Error('Failed to fetch collection data');

			const { data } = await response.json();
			let collections: Collection[] = [];

			selectedArtworks.forEach((nft) => {
				const item = data.find((item: any) => {
					const collection = item.collection;
					if (!collection) return false;
					
					// Check if contract addresses match
					const contractAddresses = collection.contractAddresses as { address: string }[] | null;
					return contractAddresses?.some((addr: any) => addr.address === nft.contractAddr) ||
						   collection.slug === nft.contractAddr;
				});

				if (item?.collection) {
					// Use the rich collection data from the API
					if (!collections.some((c) => c.slug === item.collection.slug)) {
						collections.push({
							contract: nft.contractAddr || '',
							name: item.collection.title,
							title: item.collection.title,
							description: item.collection.description,
							slug: item.collection.slug,
							websiteUrl: item.collection.websiteUrl || item.collection.projectUrl,
							imageUrl: item.collection.imageUrl,
							discordUrl: item.collection.discordUrl,
							telegramUrl: item.collection.telegramUrl,
							contractAddresses: item.collection.contractAddresses
						});
					}

					// Update NFT with collection info
					nft.contractAddr = nft.contractAddr; // Keep original
					nft.contractAlias = item.collection.title;
				}
			});

			reviewData.set({ collections });
		} else {
			// Fallback to minimal collection data if no contract addresses
			let collectionsSet = new Set<string>();

			selectedArtworks.forEach((nft) => {
				if (nft?.contractAddr) {
					const contractAliasName =
						typeof nft.contractAlias === 'object' && nft.contractAlias !== null
							? (nft.contractAlias as { name: string }).name
							: nft.contractAlias;

					collectionsSet.add(
						JSON.stringify({
							contract: nft.contractAddr,
							name: contractAliasName,
							description: ''
						})
					);
				}
			});

			let collectionsArray = Array.from(collectionsSet).map((json: string) => JSON.parse(json));
			reviewData.set({ collections: collectionsArray });
		}
		
		nfts.set(allNfts);
	} catch (error) {
		// Fallback to minimal collection data on error
		let collectionsSet = new Set<string>();

		selectedArtworks.forEach((nft) => {
			if (nft?.contractAddr) {
				const contractAliasName =
					typeof nft.contractAlias === 'object' && nft.contractAlias !== null
						? (nft.contractAlias as { name: string }).name
						: nft.contractAlias;

				collectionsSet.add(
					JSON.stringify({
						contract: nft.contractAddr,
						name: contractAliasName,
						description: ''
					})
				);
			}
		});

		let collectionsArray = Array.from(collectionsSet).map((json: string) => JSON.parse(json));
		reviewData.set({ collections: collectionsArray });
		
		return false;
	}
}

export async function setEthReviewData() {
	const allNfts = get(nfts);
	const selectedArtworks = Array.from(get(selectedNfts).values());
	const fetchUri = '/api/admin/nft-data/opensea/';

	try {
		const collectionIds = selectedArtworks.map((nft) => nft.contractAddr).filter(Boolean);
		const dataRequest = { collections: collectionIds };

		if (!fetchUri) throw new Error('Invalid wallet address');

		const response = await fetch(fetchUri, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(dataRequest)
		});

		if (!response.ok) throw new Error('Failed to fetch collection data');

		const { data } = await response.json();
		let collections: Collection[] = [];

		selectedArtworks.forEach((nft) => {
			const item = data.find((item: ApiResponse) => {
				return (
					item.collection?.contract === nft.contractAddr ||
					item.collection?.collection === nft.contractAddr
				);
			});

			if (item?.collection) {
				if (!collections.some((c) => c.contract === item.collection.contract)) {
					collections.push(item.collection);
				}

				nft.contractAddr = item.collection.contract;
				nft.contractAlias = item.collection.name;
			}
		});

		reviewData.set({ collections });
		nfts.set(allNfts);
	} catch (error) {
		return false;
	}
}
