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
import { indexArtwork } from './artworkIndexer';

const totalSteps = 3;

interface Collection {
	name: string;
	description: string;
	contract: string;
	collection?: string;
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
	collection?: {
		name: string;
		contract?: string;
		blockchain: string;
	};
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

// Add a utility function to detect MIME type from URL pattern
function detectMimeType(url: string): string | null {
	// Check file extensions
	if (url.match(/\.(mp4|webm|mov)$/i)) return 'video/mp4';
	if (url.match(/\.(jpg|jpeg)$/i)) return 'image/jpeg';
	if (url.match(/\.(png)$/i)) return 'image/png';
	if (url.match(/\.(gif)$/i)) return 'image/gif';
	if (url.match(/\.(webp)$/i)) return 'image/webp';
	if (url.match(/\.(pdf)$/i)) return 'application/pdf';
	if (url.match(/\.(html|htm)$/i)) return 'text/html';
	if (url.match(/\.(js)$/i)) return 'application/javascript';

	// Check for common interactive art platforms
	if (url.includes('fxhash.xyz') || url.includes('generator.artblocks.io')) {
		return 'text/html';
	}

	// Check for Cloudinary patterns
	if (url.includes('cloudinary.com')) {
		if (url.includes('/video/')) return 'video/mp4';
		if (url.includes('/image/')) return 'image/jpeg';
	}

	return null;
}

async function importNft(nft: ImportNft) {
	try {
		let source = 'opensea';
		const currentWallet = get(walletAddress);

		if (currentWallet.startsWith('tz')) {
			source = 'tezos';
		}

		// Ensure we have a MIME type for animation_url content
		let mimeType = nft.mime;
		if (!mimeType && nft.animation_url) {
			const detectedMime = detectMimeType(nft.animation_url);
			if (detectedMime) {
				mimeType = detectedMime;
			}
		}

		// Ensure NFT has the required fields
		const nftToImport = {
			...nft,
			tokenID: nft.tokenID || nft.token_id || nft.id?.toString(),
			name: nft.title || 'Untitled',
			description: nft.description || '',
			mime: mimeType,
			collection: {
				name: nft.collection,
				contract: nft.contractAddr || nft.collection?.contract,
				blockchain: source === 'tezos' ? 'Tezos' : 'Ethereum'
			}
		};

		const response = await fetch(`/api/admin/import/${source}/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nfts: [nftToImport] })
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.message || 'Import failed');
		}

		const result = await response.json();

		// Index the artwork if it was successfully imported
		if (result?.artwork?.id) {
			try {
				await indexArtwork(result.artwork.id);
				console.log(`Indexed artwork ${result.artwork.id}`);
			} catch (indexError) {
				console.error(`Failed to index artwork: ${indexError}`);
				// Don't throw here - we don't want to fail the import just because indexing failed
			}
		}

		return result;
	} catch (error) {
		console.error('Error importing NFT:', error);
		throw error;
	}
}

export async function startImportProcess() {
	const nftsToImport = get(nftImportQueue);

	if (!nftsToImport || nftsToImport.length === 0) {
		console.error('No NFTs to import. Ensure nftImportQueue is initialized correctly.');
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
	} catch (error) {
		console.error('Error opening review modal:', error);
	} finally {
		isLoading.set(false);
	}
}

export async function setTezReviewData() {
	const allNfts = get(nfts);
	const selectedArtworks = Array.from(get(selectedNfts).values());
	try {
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
		nfts.set(allNfts);
	} catch (error) {
		console.error('Error setting review data:', error);
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
		console.error('Error setting review data:', error);
		return false;
	}
}
