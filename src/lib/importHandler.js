import {
    nfts,
    isLoading,
    updatedNfts,
    reviewData,
    nftImportQueue,
    selectedNfts,
    importProgress,
    currentStep,
    walletAddress
} from '$lib/stores';
import { toast } from '@zerodevx/svelte-toast';
import { get } from 'svelte/store';
import ImportStatus from '$lib/components/ImportStatus.svelte';
import { tick } from 'svelte';
import { browser } from '$app/environment';
import { openModal, closeModal } from '$lib/modal';
import { all } from 'axios';

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

export function updateProgress(status, index) {
    importProgress.update((progress) => {
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

        const updatedCollection = allReviewData.collections.find((c) => {
            return c.collection === nft.collection;
        });
        const updatedArtist = allReviewData.artists.find((a) => {
            return a.address === nft.artist;
        });

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
    const wallet = get(walletAddress);

    try {

        if (wallet.startsWith('0x'))
            await setEthReviewData();
        else if (wallet.startsWith('tz'))
            await setTezReviewData();

        if (get(reviewData).collections.length > 0)
            openModal();

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
        let collectionsSet = new Set();
        let artistsSet = new Set();

        selectedIndices.forEach((index) => {
            const nft = allNfts[index];

            if (nft) {
                // Directly adding objects to Set for de-duplication
                collectionsSet.add(JSON.stringify(nft.collection)); // Convert object to string for proper comparison
                artistsSet.add(JSON.stringify(nft.artist)); // Convert object to string for proper comparison
            }
        });

        // Converting back from JSON strings to objects after de-duplication
        let collectionsArray = Array.from(collectionsSet).map(json => JSON.parse(json));
        let artistsArray = Array.from(artistsSet).map(json => JSON.parse(json));

        // Set the reviewData store with the new array of collections and artists
        reviewData.set({ collections: collectionsArray, artists: artistsArray });

        // Set the updatedNfts store with the new array of NFTs
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
        const collectionIds = selectedIndices.map((index) => allNfts[index].collection);
        const dataRequest = { collections: collectionIds };

        if (!fetchUri)
            throw new Error('Invalid wallet address');

        const response = await fetch(fetchUri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataRequest)
        });

        if (!response.ok)
            throw new Error('Failed to fetch collection and artist data');

        const { data } = await response.json();

        let collections = [];
        let artists = [];

        selectedIndices.forEach((index) => {
            const nft = allNfts[index];

            // Ensure you are matching the correct property from the NFT with the collection identifier from the data
            const item = data.find((item) => {
                return item.collection.collection === nft.collection;
            });

            if (item) {
                // Update logic to ensure proper object structure
                if (!collections.some((c) => c.collection === item.collection.collection)) {
                    collections.push(item.collection); // Assuming you want to store the whole collection object
                }

                if (!artists.some((a) => a.address === item.artist.address)) {
                    artists.push(item.artist); // Assuming you want to store the whole artist object
                }

                // Updating the NFT with correct artist's address
                nft.artist = item.artist.address; // Check if 'artist' should indeed be an object or just an address
            }
        });

        // set the reviewData store with the new array of collections and artists
        reviewData.set({ collections, artists });

        // set the updatedNfts store with the new array of NFTs
        nfts.set(allNfts);

    } catch (error) {
        console.error('Error setting review data:', error);
        return false;
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

export async function finalizeImport() {
    const updatedNftsArray = get(updatedNfts);

    nftImportQueue.set(updatedNftsArray);
    if (browser) localStorage.setItem('nftImportQueue', JSON.stringify(updatedNftsArray));

    // Ensure each NFT in updatedNftsArray has an `id`, `name`, and initial `status`
    const importProgressInit = updatedNftsArray.map((nft) => ({
        id: nft.id, // Ensure this is correctly assigned
        name: nft.name, // Ensure this is present
        status: 'loading' // Initial status
    }));

    importProgress.set(importProgressInit);
    if (browser) localStorage.setItem('importProgress', JSON.stringify(importProgressInit));

    closeModal();

    // Start the import process
    await startImportProcess();
}

async function importNft(nft) {
    try {
        const response = await fetch(`/api/admin/import/opensea/`, {
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
