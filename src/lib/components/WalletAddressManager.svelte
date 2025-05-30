<!-- WalletAddressManager.svelte -->
<script lang="ts">
	import type { WalletAddress } from '$lib/types/wallet';
	import { fade } from 'svelte/transition';

	// Props
	export let addresses: WalletAddress[] = [];
	export let onClose: () => void = () => {};
	export let onAdd: (address: string, alias: string, blockchain: string) => void = () => {};
	export let onRemove: (address: string, blockchain: string) => void = () => {};

	// State
	let newAddress = '';
	let alias = '';
	let blockchain = 'ethereum';
	let isSubmitting = false;

	// Get blockchain label for display
	function getBlockchainLabel(blockchain: string): string {
		const labels: Record<string, string> = {
			ethereum: 'ETH',
			tezos: 'XTZ',
			polygon: 'MATIC',
			solana: 'SOL'
		};
		return labels[blockchain] || blockchain;
	}

	// Handle form submission
	async function handleSubmit() {
		if (!newAddress || isSubmitting) return;

		// Auto-detect blockchain if not specified
		if (!blockchain) {
			if (newAddress.startsWith('tz')) {
				blockchain = 'tezos';
			} else if (newAddress.startsWith('0x')) {
				blockchain = 'ethereum';
			}
		}

		isSubmitting = true;

		try {
			await onAdd(newAddress, alias, blockchain);

			// Reset form
			newAddress = '';
			alias = '';
			blockchain = 'ethereum';
		} catch (error) {
			console.error('Error adding wallet address:', error);
		} finally {
			isSubmitting = false;
		}
	}

	// Detect blockchain from address format
	function detectBlockchain() {
		if (newAddress.startsWith('tz')) {
			blockchain = 'tezos';
		} else if (newAddress.startsWith('0x')) {
			blockchain = 'ethereum';
		}
	}
</script>

<div class="modal-overlay" transition:fade={{ duration: 200 }}>
	<div class="modal-container rounded-md shadow-lg bg-white dark:bg-gray-800">
		<div class="modal-header flex justify-between items-center p-4 border-b dark:border-gray-700">
			<h2 class="text-xl font-bold m-0 dark:text-gray-100">Wallet Addresses</h2>
			<button class="close-button text-2xl leading-none dark:text-gray-300" on:click={onClose}
				>&times;</button
			>
		</div>

		<div class="modal-body p-4">
			<!-- Add New Address Form -->
			<div class="add-address-form mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
				<h3 class="text-lg font-semibold mb-2 dark:text-gray-100">Add New Address</h3>
				<form on:submit|preventDefault={handleSubmit} class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="form-group col-span-2 md:col-span-1">
						<label for="new-address" class="block mb-1 dark:text-gray-300">Wallet Address</label>
						<input
							type="text"
							id="new-address"
							bind:value={newAddress}
							on:input={detectBlockchain}
							placeholder="0x... or tz..."
							class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
							required
							disabled={isSubmitting}
						/>
					</div>

					<div class="form-group">
						<label for="alias" class="block mb-1 dark:text-gray-300">Alias (Optional)</label>
						<input
							type="text"
							id="alias"
							bind:value={alias}
							placeholder="e.g. My Primary Wallet"
							class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
							disabled={isSubmitting}
						/>
					</div>

					<div class="form-group">
						<label for="blockchain" class="block mb-1 dark:text-gray-300">Blockchain</label>
						<select
							id="blockchain"
							bind:value={blockchain}
							class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
							required
							disabled={isSubmitting}
						>
							<option value="ethereum">Ethereum</option>
							<option value="tezos">Tezos</option>
							<option value="polygon">Polygon</option>
							<option value="solana">Solana</option>
						</select>
					</div>

					<div class="col-span-2 text-right">
						<button
							type="submit"
							class="primary button mt-0"
							disabled={isSubmitting || !newAddress}
						>
							{isSubmitting ? 'Adding...' : 'Add Address'}
						</button>
					</div>
				</form>
			</div>

			<!-- Saved Addresses -->
			{#if addresses.length > 0}
				<div class="saved-addresses">
					<h3 class="text-lg font-semibold mb-2 dark:text-gray-100">Saved Addresses</h3>
					<div class="overflow-x-auto">
						<table class="w-full border-collapse">
							<thead class="bg-gray-50 dark:bg-gray-700">
								<tr>
									<th class="p-2 text-left border dark:border-gray-600 dark:text-gray-300"
										>Address</th
									>
									<th class="p-2 text-left border dark:border-gray-600 dark:text-gray-300"
										>Blockchain</th
									>
									<th class="p-2 text-left border dark:border-gray-600 dark:text-gray-300">Alias</th
									>
									<th class="p-2 text-left border dark:border-gray-600 dark:text-gray-300"
										>Actions</th
									>
								</tr>
							</thead>
							<tbody>
								{#each addresses as addr}
									<tr class="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
										<td class="p-2 border dark:border-gray-600 dark:text-gray-300">
											<div class="address-text overflow-hidden text-ellipsis" title={addr.address}>
												{addr.address}
											</div>
										</td>
										<td class="p-2 border dark:border-gray-600">
											<span
												class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
											>
												{getBlockchainLabel(addr.blockchain)}
											</span>
										</td>
										<td class="p-2 border dark:border-gray-600 dark:text-gray-300"
											>{addr.alias || '-'}</td
										>
										<td class="p-2 border dark:border-gray-600">
											<button
												class="small-button remove text-sm py-1 px-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
												on:click={() => onRemove(addr.address, addr.blockchain)}
											>
												Delete
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
					<p class="no-addresses text-gray-600 dark:text-gray-400">No saved addresses yet.</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-container {
		width: 90%;
		max-width: 800px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.address-text {
		max-width: 200px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 640px) {
		.modal-container {
			width: 95%;
			max-width: none;
		}

		.address-text {
			max-width: 120px;
		}
	}
</style>
