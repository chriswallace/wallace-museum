import { nftImportQueue, importProgress } from '$lib/stores';
import { showToast } from '$lib/toastHelper';
import { get } from 'svelte/store';
import { browser } from '$app/environment';

export async function startImportProcess() {
    if (browser) {
        // Ensure stores are initialized from localStorage
        nftImportQueue.useLocalStorage();
        importProgress.useLocalStorage();

        let { current, total } = get(importProgress);
        let nftsToImport = get(nftImportQueue);

        // If there's nothing to import or the import is already complete, return
        if (nftsToImport.length === 0 || current >= total) {
            showToast('No NFTs to import or import already completed.', 'info');
            return;
        }

        // Update total in case the queue has changed since the last attempt
        total = nftsToImport.length;

        for (let i = current; i < nftsToImport.length; i++) {
            const nft = nftsToImport[i];
            try {
                // Your logic to import an NFT, ensure this function is properly defined
                await importNft(nft);

                importProgress.update(n => ({ ...n, current: i + 1, message: `Importing ${i + 1} of ${nftsToImport.length}` }));
                showToast(`Imported ${nft.name}`, 'success');
            } catch (error) {
                showToast(`Failed to import ${nft.name}: ${error.message}`, 'error');
                // Optionally, break the loop if you want to stop at the first error
                break;
            }
        }

        if (get(importProgress).current >= total) {
            showToast('Import completed successfully.', 'success');
            // Reset the queue and progress
            nftImportQueue.set([]);
            importProgress.set({ current: 0, total: 0, message: '' });
        }
    }
}

async function importNft(nft) {

    //console.log("importNft", nft);

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