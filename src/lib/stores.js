// src/stores.js
import { writable } from 'svelte/store';

function createSelectedArtworkStore() {
    const { subscribe, set, update } = writable(null);

    return {
        subscribe,
        setSelected: (artwork) => set(artwork),
        resetSelected: () => set(null)
    };
}

export const walletAddress = writable('');
export const nftType = writable('collected');
export const nfts = writable([]);
export const isLoading = writable(false);
export const isModalOpen = writable(false);
export const selectedNfts = writable(new Set());
export const selectAllChecked = writable(false);
export const importStatus = writable([]);
export const reviewData = writable({ collections: [], artists: [] });
export const updatedNfts = writable([]);

export const selectedArtwork = createSelectedArtworkStore();

export const isMaximized = writable(false);

export const isLiveCodeVisible = writable(false); // New state to track live code visibility
