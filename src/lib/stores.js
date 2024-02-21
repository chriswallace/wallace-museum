// src/stores.js
import { writable } from 'svelte/store';

function createSelectedArtworkStore() {
	const { subscribe, set } = writable(null);

	return {
		subscribe,
		setSelected: (artwork) => set(artwork),
		resetSelected: () => set(null)
	};
}

// Helper function to safely access localStorage
function safeLocalStorage() {
	if (typeof window !== 'undefined') {
		return window.localStorage;
	}
	// Mock localStorage for server-side compatibility
	return {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {}
	};
}

function createLocalStorageStore(key, startValue) {
	const { subscribe, set, update } = writable(startValue);

	// Initialize storage with safeLocalStorage to avoid SSR issues
	const storage = safeLocalStorage();

	// Use a browser check to safely initialize store from localStorage
	if (typeof window !== 'undefined') {
		const json = storage.getItem(key);
		if (json) {
			set(JSON.parse(json));
		}

		// Safely add event listener for storage events
		window.addEventListener('storage', (event) => {
			if (event.key === key) {
				set(JSON.parse(event.newValue));
			}
		});
	}

	return {
		subscribe,
		set: (value) => {
			// Ensure we're in a browser environment before accessing localStorage
			if (typeof window !== 'undefined') {
				storage.setItem(key, JSON.stringify(value));
			}
			set(value);
		},
		update,
		useLocalStorage: () => {
			// Additional check for browser environment
			if (typeof window !== 'undefined') {
				const json = storage.getItem(key);
				if (json) {
					set(JSON.parse(json));
				}
			}
		}
	};
}

export const nftImportQueue = createLocalStorageStore('nftImportQueue', []);
export const importProgress = createLocalStorageStore('importProgress', []);

export const walletAddress = writable('');
export const nftType = writable('collected');
export const nfts = writable([]);
export const isLoading = writable(false);
export const isModalOpen = writable(false);
export const selectedNfts = writable(new Set());
export const selectAllChecked = writable(false);
export const reviewData = writable({ collections: [], artists: [] });
export const updatedNfts = writable([]);
export const selectedArtwork = createSelectedArtworkStore();
export const isMaximized = writable(false);
export const isLiveCodeVisible = writable(false); // New state to track live code visibility
export const currentStep = writable(1);
