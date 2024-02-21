import {
	nfts,
	isLoading,
	updatedNfts,
	reviewData,
	nftImportQueue,
	selectedNfts,
	importProgress,
	currentStep
} from '$lib/stores';
import { toast } from '@zerodevx/svelte-toast';
import { get } from 'svelte/store';
import ImportStatus from '$lib/ImportStatus.svelte';
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { openModal, closeModal } from '$lib/modal';

const totalSteps = 3;

// Update nextStep to use the store
export function nextStep() {
	let current = get(currentStep);
	currentStep.update((value) => {
		if (value === 2) {
			finalReviewSync();
		}
		return value < totalSteps ? value + 1 : value;
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

export function updateProgress(status, nftId) {
	importProgress.update((progress) => {
		const index = progress.findIndex((item) => item.id === nftId);
		if (index !== -1) {
			// Create a new progress item with the updated status
			const updatedItem = { ...progress[index], status: status };
			// Create a new array with the updated item
			const updatedProgress = [
				...progress.slice(0, index),
				updatedItem,
				...progress.slice(index + 1)
			];
			localStorage.setItem('importProgress', JSON.stringify(updatedProgress));
			return updatedProgress;
		}
		return progress;
	});
}

export function finalReviewSync() {
	// Use get to access the current values of the stores
	const allNfts = get(nfts);
	const allReviewData = get(reviewData);
	const selectedIndices = Array.from(get(selectedNfts));

	const update = selectedIndices.map((index) => {
		const nft = allNfts[index];

		// Find the updated collection and artist for the current NFT
		const updatedCollection = allReviewData.collections.find((c) => c.id === nft.collectionId);
		const updatedArtist = allReviewData.artists.find((a) => a.id === nft.artistId);

		// Return a new object with the updated collection and artist, along with the rest of the NFT properties
		return {
			...nft,
			collection: updatedCollection ?? nft.collection, // Fallback to the original collection if not found
			artist: updatedArtist ?? nft.artist // Fallback to the original artist if not found
		};
	});

	// Update the updatedNfts store with the new array of NFTs
	updatedNfts.set(update);
}

export async function openReviewModal() {
	const allNfts = get(nfts);
	const selectedIndices = Array.from(get(selectedNfts));

	try {
		// Assuming collectionSlugs need to be collected differently based on your correction
		const collectionSlugs = selectedIndices.map((index) => allNfts[index].collection);

		const response = await fetch('/api/admin/nft-data/ethereum', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ collections: collectionSlugs })
		});

		if (!response.ok) throw new Error('Failed to fetch collection and artist data');
		const { data } = await response.json();

		let collections = [];
		let artists = [];

		// Update NFTs with artist address directly during data processing
		selectedIndices.forEach((index) => {
			const nft = allNfts[index];
			const item = data.find((item) => item.collection.collection === nft.collection);

			if (item) {
				// Ensure the collection is added if not already included
				if (!collections.some((c) => c.collection === item.collection.collection)) {
					collections.push(item.collection);
				}

				// Ensure the artist is added if not already included
				if (!artists.some((a) => a.address === item.artist.address)) {
					artists.push(item.artist);
				}

				// Here's the crucial part: updating the NFT with the artist's address
				nft.artist = item.artist.address; // Assign artist's Ethereum address to the NFT
			}
		});

		// After processing, update the reviewData store
		reviewData.set({ collections, artists });

		// Update the nfts store with the modified NFTs, ensuring artist addresses are included
		nfts.set(allNfts);
		openModal();
	} catch (error) {
		console.error('Error opening review modal:', error);
	} finally {
		isLoading.set(false);
	}
}

export async function startImportProcess() {
	let nftsToImport = get(nftImportQueue);

	if (!nftsToImport || nftsToImport.length === 0) {
		console.error('No NFTs to import. Ensure nftImportQueue is initialized correctly.');
		return;
	}

	showImportToast();

	for (let i = 0; i < nftsToImport.length; i++) {
		const nft = nftsToImport[i];

		updateProgress('loading', nft.id);

		try {
			await importNft(nft);
			updateProgress('complete', nft.id);
		} catch (error) {
			updateProgress('error', nft.id);
		}

		await tick();
	}

	hideImportToast();
}

export async function finalizeImport() {
	const updatedNftsArray = get(updatedNfts);

	nftImportQueue.set(updatedNftsArray);
	if (browser) localStorage.setItem('nftImportQueue', JSON.stringify(updatedNftsArray));

	// Ensure each NFT in updatedNftsArray has an `id`, `name`, and initial `status`
	const importProgressInit = updatedNftsArray.map((nft) => ({
		id: nft.id, // Ensure this is correctly assigned
		name: nft.name, // Ensure this is present
		status: 'pending' // Initial status
	}));

	importProgress.set(importProgressInit);
	if (browser) localStorage.setItem('importProgress', JSON.stringify(importProgressInit));

	closeModal();

	// Start the import process
	await startImportProcess();
}

async function importNft(nft) {
	try {
		const response = await fetch('/api/admin/import/eth/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nfts: Array(nft) })
		});

		if (response.ok) {
			const result = await response.json();
		} else {
			const result = await response.json();
			console.error(result.message);
		}
	} catch (error) {
		console.error('Error:', error);
	}
}

export function handleCollectionSave(editedCollection, index) {
	const reviewDataArray = get(reviewData);

	reviewDataArray.update((array) => {
		array.collections[index] = editedCollection;
		return array;
	});
}

export function handleArtistSave(editedArtist, index) {
	const reviewDataArray = get(reviewData);

	reviewData.update((array) => {
		array.artists[index] = editedArtist;
		return array;
	});
}
