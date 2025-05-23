// src/stores.ts
import { writable, get, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Define Artwork and related types (adjust if these are defined elsewhere and can be imported)
interface Artist {
	id: number;
	name: string;
	websiteUrl?: string;
}

interface ArtistArtwork {
	artist: Artist;
}

export interface Artwork {
	id: number;
	title: string;
	description: string;
	image_url?: string;
	animation_url?: string;
	dimensions?: { width: number; height: number };
	contractAddr?: string;
	contractAlias?: string;
	tokenStandard?: string;
	tokenID?: string;
	mintDate?: string | Date;
	mime?: string;
	tags?: string[];
	attributes?: { trait_type: string; value: string }[];
	ArtistArtworks?: ArtistArtwork[];
	src?: string;
	srcset?: string;
	sizes?: string;
	blockchain?: string;
}

// Define the NFT type (consistent with +page.svelte)
/**
 * @typedef {object} NftItem
 * @property {string | number} id
 * @property {string | null} [animation_url]
 * @property {string | null} [image_url]
 * @property {string} name
 * @property {string | null} [mime]
 * // Add other relevant properties if needed
 */

interface SelectedArtworkStore extends Writable<Artwork | null> {
	setSelected: (artwork: Artwork | null) => void;
	resetSelected: () => void;
}

function createSelectedArtworkStore(): SelectedArtworkStore {
	const { subscribe, set, update: svelteUpdate } = writable<Artwork | null>(null);
	const store = { subscribe, set, update: svelteUpdate }; // Capture the core store methods

	return {
		subscribe,
		set,
		update: svelteUpdate,
		setSelected: (artwork: Artwork | null) => set(artwork),
		resetSelected: () => set(null)
	};
}

// Helper function to safely access localStorage
function safeLocalStorage() {
	if (browser) {
		// Use imported browser check
		return window.localStorage;
	}
	// Mock localStorage for server-side compatibility
	return {
		getItem: (_key: string): string | null => null,
		setItem: (_key: string, _value: string): void => {},
		removeItem: (_key: string): void => {}
	};
}

// Define a type for the localStorage store that includes the useLocalStorage method
interface LocalStorageStore<T> extends Writable<T> {
	useLocalStorage: () => void;
}

// EXPORT the factory function
export function createLocalStorageStore<T>(key: string, startValue: T): LocalStorageStore<T> {
	const { subscribe, set, update } = writable<T>(startValue);

	// Initialize storage with safeLocalStorage to avoid SSR issues
	const storage = safeLocalStorage();

	// Use a browser check to safely initialize store from localStorage
	if (browser) {
		const json = storage.getItem(key);
		if (json) {
			try {
				set(JSON.parse(json));
			} catch (e) {
				console.error(`Error parsing localStorage key "${key}":`, e);
			}
		}

		// Safely add event listener for storage events
		window.addEventListener('storage', (event) => {
			if (event.key === key && event.newValue) {
				// Check if newValue exists
				try {
					set(JSON.parse(event.newValue));
				} catch (e) {
					console.error(`Error parsing storage event for key "${key}":`, e);
				}
			} else if (event.key === key && !event.newValue) {
				// Handle removal or clearing of the item
				set(startValue); // Reset to startValue or handle as appropriate
			}
		});
	}

	return {
		subscribe,
		set: (value: T) => {
			// Ensure we're in a browser environment before accessing localStorage
			if (browser) {
				try {
					storage.setItem(key, JSON.stringify(value));
				} catch (e) {
					console.error(`Error setting localStorage key "${key}":`, e);
				}
			}
			set(value);
		},
		update: (updater: (value: T) => T) => {
			// Use the original writable's update, but add localStorage logic
			update((currentValue) => {
				const newValue = updater(currentValue);
				// Ensure we're in a browser environment before accessing localStorage
				if (browser) {
					try {
						storage.setItem(key, JSON.stringify(newValue));
					} catch (e) {
						console.error(`Error setting localStorage key "${key}" during update:`, e);
					}
				}
				return newValue;
			});
		},
		useLocalStorage: () => {
			// Additional check for browser environment
			if (browser) {
				const json = storage.getItem(key);
				if (json) {
					try {
						set(JSON.parse(json));
					} catch (e) {
						console.error(`Error parsing localStorage key "${key}" on useLocalStorage:`, e);
					}
				}
			}
		}
	};
}

// Apply generic types where createLocalStorageStore is used
export const nftImportQueue = createLocalStorageStore<any[]>('nftImportQueue', []); // Use specific type if known
export const importProgress = createLocalStorageStore<any[]>('importProgress', []); // Use specific type if known

// Other stores
export const walletAddress = writable<string>('');
export const nftType = writable<string>('collected');

// Apply the NftItem type to the writable store
/** @type {import('svelte/store').Writable<NftItem[]>} */ // Keep JSDoc for clarification if desired
export const nfts = writable<Artwork[]>([]); // Assuming NftItem is similar to Artwork for now

export const isLoading = writable<boolean>(false);
export const isModalOpen = writable<boolean>(false);
export const selectedNfts = writable<Map<number, Artwork>>(new Map()); // Store both ID and artwork object
export const selectAllChecked = writable<boolean>(false);
export const reviewData = writable<{ collections: any[] }>({ collections: [] });
export const updatedNfts = writable<Artwork[]>([]);
export const selectedArtwork = createSelectedArtworkStore();
export const isMaximized = writable<boolean>(false);
export const isLiveCodeVisible = writable<boolean>(false);
export const currentStep = writable<number>(1);

/**
 * Creates a persistent Svelte store that synchronizes with localStorage.
 * @template T
 * @param {string} key The key for localStorage.
 * @param {T} startValue The initial value if none is found in localStorage.
 * @returns {import('svelte/store').Writable<T>}
 */
function createPersistentStore<T>(key: string, startValue: T): Writable<T> {
	const initialValue = browser ? localStorage.getItem(key) : null;
	// Use startValue if localStorage is null or empty, parse if it exists
	const storeValue = initialValue ? JSON.parse(initialValue) : startValue;

	const { subscribe, set, update } = writable<T>(storeValue); // Correct generic syntax

	return {
		subscribe,
		set: (value: T) => {
			if (browser) {
				localStorage.setItem(key, JSON.stringify(value));
			}
			set(value);
		},
		update: (updater: (value: T) => T) => {
			update((currentValue) => {
				const newValue = updater(currentValue);
				if (browser) {
					localStorage.setItem(key, JSON.stringify(newValue));
				}
				return newValue;
			});
		}
	};
}

// Example usage for persistent stores if needed
// export const persistentStoreExample = createPersistentStore<object>('myKey', { initial: 'data' });
