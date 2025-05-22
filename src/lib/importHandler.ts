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

export async function finalizeImport() {
	const updatedNftsArray = get(updatedNfts);

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

async function importNft(nft: ImportNft) {
	try {
		let source = 'opensea';
		const currentWallet = get(walletAddress);

		if (currentWallet.startsWith('tz')) {
			source = 'tezos';
		}

		// Ensure NFT has the required fields
		const nftToImport = {
			...nft,
			tokenID: nft.tokenID || nft.token_id || nft.id?.toString(),
			name: nft.title || 'Untitled',
			description: nft.description || '',
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
	selectedNfts.set(new Set());
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
	const selectedIndices = Array.from(get(selectedNfts));
	try {
		let collectionsSet = new Set<string>();

		selectedIndices.forEach((index) => {
			const nft = allNfts[index];

			if (nft?.contractAddr) {
				collectionsSet.add(
					JSON.stringify({
						contract: nft.contractAddr,
						name: nft.contractAlias,
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
	const selectedIndices = Array.from(get(selectedNfts));
	const fetchUri = '/api/admin/nft-data/opensea/';

	try {
		const collectionIds = selectedIndices.map((index) => allNfts[index].contractAddr);
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

		selectedIndices.forEach((index) => {
			const nft = allNfts[index];
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
