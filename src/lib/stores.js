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

export const selectedArtwork = createSelectedArtworkStore();

export const isMaximized = writable(false);

export const isLiveCodeVisible = writable(false); // New state to track live code visibility
