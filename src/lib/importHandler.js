import { nftImportQueue, importProgress } from '$lib/stores';
import { toast } from '@zerodevx/svelte-toast';
import { get } from 'svelte/store';
import ImportStatus from '$lib/ImportStatus.svelte';

export function showImportToast() {
    toast.push('Importing', {
        component: { src: ImportStatus }, initial: 0, dismissable: false, theme: {
            '--toastBackground': '#fff', '--toastColor': '#444'
        }
    });
}

export function hideImportToast() {
    setInterval(() => {
        toast.pop();
    }, 2000);
}

export async function startImportProcess() {
    let nftsToImport = get(nftImportQueue);

    showImportToast();

    for (let i = 0; i < nftsToImport.length; i++) {
        const nft = nftsToImport[i];
        // Immediately update the store to reflect the NFT is being imported
        importProgress.update(progress => progress.map(item =>
            item.id === nft.id ? { ...item, status: 'loading' } : item
        ));

        try {
            await importNft(nft); // Your import logic here
            // Update the store to reflect the NFT import is complete
            importProgress.update(progress => progress.map(item =>
                item.id === nft.id ? { ...item, status: 'complete' } : item
            ));
        } catch (error) {
            // Update the store to reflect an error occurred during the import
            importProgress.update(progress => progress.map(item =>
                item.id === nft.id ? { ...item, status: 'error' } : item
            ));
        }
    }

    hideImportToast();
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