<!-- SelectiveWalletImporter.svelte -->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { WalletAddress } from '$lib/types/wallet';

	// Props
	export let onClose: () => void = () => {};
	export let onImport: (selectedWallets: WalletWithCount[]) => void = () => {};

	// Extended wallet type with artwork count
	interface WalletWithCount extends WalletAddress {
		artworkCount: number;
	}

	// State
	let wallets: WalletWithCount[] = [];
	let selectedWallets: Set<string> = new Set();
	let isLoading = true;
	let error = '';
	let selectAll = false;
	let totalArtworkCount = 0;

	// Load wallets with artwork counts
	async function loadWallets() {
		try {
			isLoading = true;
			error = '';
			console.log('Loading wallets with artwork counts...');
			
			const response = await fetch('/api/admin/wallets?includeCounts=true');
			const data = await response.json();
			
			console.log('Wallets API response:', data);
			
			if (data.success) {
				wallets = data.walletAddresses || [];
				console.log('Loaded wallets:', wallets);
				
				// Auto-select all wallets by default
				selectedWallets.clear();
				wallets.forEach(wallet => {
					const key = getWalletKey(wallet);
					selectedWallets.add(key);
					console.log(`Auto-selected wallet: ${key} with ${wallet.artworkCount} artworks`);
				});
				selectedWallets = selectedWallets; // Trigger reactivity
				selectAll = wallets.length > 0; // Set selectAll to true if we have wallets
				console.log(`Auto-selected ${selectedWallets.size} wallets, selectAll: ${selectAll}`);
			} else {
				error = data.error || 'Failed to load wallets';
				console.error('Failed to load wallets:', error);
			}
		} catch (err) {
			console.error('Error loading wallets:', err);
			error = err instanceof Error ? err.message : 'Failed to load wallets';
		} finally {
			isLoading = false;
		}
	}

	// Initialize on mount
	loadWallets();

	// Get blockchain label for display
	function getBlockchainLabel(blockchain: string): string {
		const labels: Record<string, string> = {
			ethereum: 'ETH',
			tezos: 'XTZ',
			polygon: 'MATIC',
			solana: 'SOL'
		};
		return labels[blockchain] || blockchain.toUpperCase();
	}

	// Format wallet address for display
	function formatAddress(address: string): string {
		if (address.length <= 10) return address;
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	// Generate unique key for wallet
	function getWalletKey(wallet: WalletWithCount): string {
		return `${wallet.address}-${wallet.blockchain}`;
	}

	// Toggle individual wallet selection
	function toggleWallet(wallet: WalletWithCount) {
		const key = getWalletKey(wallet);
		if (selectedWallets.has(key)) {
			selectedWallets.delete(key);
		} else {
			selectedWallets.add(key);
		}
		selectedWallets = selectedWallets; // Trigger reactivity
		
		// Update select all state
		selectAll = selectedWallets.size === wallets.length;
	}

	// Toggle select all
	function toggleSelectAll() {
		// The selectAll variable is already updated by the bind:checked
		// So we use the current value to determine what to do
		if (selectAll) {
			// Select all wallets
			selectedWallets.clear();
			wallets.forEach(wallet => {
				selectedWallets.add(getWalletKey(wallet));
			});
		} else {
			// Deselect all wallets
			selectedWallets.clear();
		}
		selectedWallets = selectedWallets; // Trigger reactivity
	}

	// Get selected wallets for import
	function getSelectedWallets(): WalletWithCount[] {
		return wallets.filter(wallet => selectedWallets.has(getWalletKey(wallet)));
	}

	// Handle import
	function handleImport() {
		const selected = getSelectedWallets();
		console.log('handleImport called with selected wallets:', selected);
		console.log('Total artwork count for selected wallets:', totalArtworkCount);
		if (selected.length > 0) {
			console.log('Calling onImport with selected wallets');
			onImport(selected);
		} else {
			console.warn('No wallets selected for import');
		}
	}

	// Calculate total artwork count for selected wallets
	$: {
		totalArtworkCount = 0;
		if (wallets.length > 0 && selectedWallets.size > 0) {
			for (const wallet of wallets) {
				if (selectedWallets.has(getWalletKey(wallet))) {
					totalArtworkCount += (wallet.artworkCount || 0);
				}
			}
		}
		console.log(`Total artwork count: ${totalArtworkCount} from ${selectedWallets.size} selected wallets`);
	}
	$: hasSelection = selectedWallets.size > 0;
</script>

<div class="modal-overlay" transition:fade={{ duration: 200 }}>
	<div class="modal-container rounded-md shadow-lg bg-white dark:bg-gray-800 max-w-4xl">
		<div class="modal-header flex justify-between items-center p-4 border-b dark:border-gray-700">
			<h2 class="text-xl font-bold m-0 dark:text-gray-100">Select Wallets to Index</h2>
			<button class="close-button text-2xl leading-none dark:text-gray-300" on:click={onClose}
				>&times;</button
			>
		</div>

		<div class="modal-body p-4 max-h-[70vh] overflow-y-auto">
			{#if isLoading}
				<div class="loading-state text-center py-8">
					<div class="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
					<p class="text-gray-600 dark:text-gray-400">Loading wallets and artwork counts...</p>
				</div>
			{:else if error}
				<div class="error-state text-center py-8">
					<div class="text-red-500 mb-4">
						<svg class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
						</svg>
					</div>
					<p class="text-red-600 dark:text-red-400 font-medium">Error loading wallets</p>
					<p class="text-gray-600 dark:text-gray-400 text-sm mt-1">{error}</p>
					<button 
						class="secondary button mt-4" 
						on:click={loadWallets}
					>
						Try Again
					</button>
				</div>
			{:else if wallets.length === 0}
				<div class="empty-state text-center py-8">
					<div class="text-gray-400 mb-4">
						<svg class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
						</svg>
					</div>
					<p class="text-gray-600 dark:text-gray-400 font-medium">No wallets configured</p>
					<p class="text-gray-500 dark:text-gray-500 text-sm mt-1">Add wallet addresses in the settings to enable indexing.</p>
				</div>
			{:else}
				<!-- Select All Header -->
				<div class="select-all-header mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
					<label class="flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={selectAll}
							on:change={toggleSelectAll}
							class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-sm"
						/>
						<span class="font-medium dark:text-gray-100">
							Select All ({wallets.length} wallets)
						</span>
						{#if hasSelection}
							<span class="ml-2 text-sm text-gray-600 dark:text-gray-400">
								• {selectedWallets.size} selected • {totalArtworkCount} NFTs
							</span>
						{/if}
					</label>
				</div>

				<!-- Wallet List -->
				<div class="wallet-list space-y-2">
					{#each wallets as wallet (getWalletKey(wallet))}
						<div class="wallet-item p-3 border dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
							<label class="flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={selectedWallets.has(getWalletKey(wallet))}
									on:change={() => toggleWallet(wallet)}
									class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-sm"
								/>
								
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between">
										<div class="flex items-center space-x-3">
											<!-- Blockchain Badge -->
											<span class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
												{getBlockchainLabel(wallet.blockchain)}
											</span>
											
											<!-- Wallet Address -->
											<div class="wallet-info">
												<div class="font-mono text-sm dark:text-gray-100" title={wallet.address}>
													{formatAddress(wallet.address)}
												</div>
												{#if wallet.alias}
													<div class="text-xs text-gray-500 dark:text-gray-400">
														{wallet.alias}
													</div>
												{/if}
											</div>
										</div>
										
										<!-- NFT Count -->
										<div class="artwork-count text-right">
											<div class="text-lg font-semibold text-blue-600 dark:text-blue-400">
												{wallet.artworkCount}
											</div>
											<div class="text-xs text-gray-500 dark:text-gray-400">
												NFT{wallet.artworkCount !== 1 ? 's' : ''}
											</div>
										</div>
									</div>
								</div>
							</label>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		{#if !isLoading && !error && wallets.length > 0}
			<div class="modal-footer flex justify-between items-center p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
				<div class="selection-summary text-sm text-gray-600 dark:text-gray-400">
					{#if hasSelection}
						{selectedWallets.size} wallet{selectedWallets.size !== 1 ? 's' : ''} selected
						• {totalArtworkCount} NFT{totalArtworkCount !== 1 ? 's' : ''} to index
					{:else}
						Select wallets to index their NFTs
					{/if}
				</div>
				
				<div class="action-buttons flex gap-3">
					<button class="secondary button" on:click={onClose}>
						Cancel
					</button>
					<button 
						class="save button" 
						disabled={!hasSelection}
						on:click={handleImport}
					>
						Index Selected ({totalArtworkCount})
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-container {
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
	}

	.close-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-button:hover {
		opacity: 0.7;
	}

	.wallet-item:hover input[type="checkbox"] {
		border-color: #3b82f6;
	}

	.blockchain-badge {
		flex-shrink: 0;
	}

	.wallet-info {
		min-width: 0;
		flex: 1;
	}

	.artwork-count {
		flex-shrink: 0;
	}
</style> 