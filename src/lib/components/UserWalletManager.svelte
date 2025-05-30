<!-- UserWalletManager.svelte -->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { 
		parseWalletInput, 
		formatWalletsForStorage, 
		detectBlockchain, 
		getBlockchainDisplayName,
		groupWalletsByBlockchain 
	} from '$lib/utils/walletUtils.js';

	// Props
	export let userWallets: any[] = [];
	export let onClose: () => void = () => {};
	export let onRefresh: () => void = () => {};

	// State
	let newWalletName = '';
	let newWalletAddresses = '';
	let isSubmitting = false;
	let editingWallet: any = null;
	let editName = '';
	let editAddresses = '';

	// Handle form submission for new wallet
	async function handleSubmit() {
		if (!newWalletAddresses.trim() || isSubmitting) return;

		isSubmitting = true;

		try {
			const response = await fetch('/api/admin/user-wallets', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: newWalletName || null,
					wallets: newWalletAddresses
				})
			});

			const data = await response.json();

			if (response.ok) {
				// Reset form
				newWalletName = '';
				newWalletAddresses = '';
				onRefresh();
			} else {
				console.error('Error creating user wallet:', data.error);
				alert(data.error || 'Failed to create wallet');
			}
		} catch (error) {
			console.error('Error creating user wallet:', error);
			alert('Failed to create wallet');
		} finally {
			isSubmitting = false;
		}
	}

	// Handle wallet deletion
	async function handleDelete(walletId: number) {
		if (!confirm('Are you sure you want to delete this wallet set?')) return;

		try {
			const response = await fetch('/api/admin/user-wallets', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ id: walletId })
			});

			const data = await response.json();

			if (response.ok) {
				onRefresh();
			} else {
				console.error('Error deleting user wallet:', data.error);
				alert(data.error || 'Failed to delete wallet');
			}
		} catch (error) {
			console.error('Error deleting user wallet:', error);
			alert('Failed to delete wallet');
		}
	}

	// Start editing a wallet
	function startEdit(wallet: any) {
		editingWallet = wallet;
		editName = wallet.name || '';
		editAddresses = wallet.wallets.map((w: any) => w.address).join('\n');
	}

	// Cancel editing
	function cancelEdit() {
		editingWallet = null;
		editName = '';
		editAddresses = '';
	}

	// Handle wallet update
	async function handleUpdate() {
		if (!editAddresses.trim() || isSubmitting) return;

		isSubmitting = true;

		try {
			const response = await fetch('/api/admin/user-wallets', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: editingWallet.id,
					name: editName || null,
					wallets: editAddresses
				})
			});

			const data = await response.json();

			if (response.ok) {
				cancelEdit();
				onRefresh();
			} else {
				console.error('Error updating user wallet:', data.error);
				alert(data.error || 'Failed to update wallet');
			}
		} catch (error) {
			console.error('Error updating user wallet:', error);
			alert('Failed to update wallet');
		} finally {
			isSubmitting = false;
		}
	}

	// Toggle wallet enabled status
	async function toggleEnabled(wallet: any) {
		try {
			const response = await fetch('/api/admin/user-wallets', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: wallet.id,
					enabled: !wallet.enabled
				})
			});

			const data = await response.json();

			if (response.ok) {
				onRefresh();
			} else {
				console.error('Error toggling wallet status:', data.error);
				alert(data.error || 'Failed to update wallet status');
			}
		} catch (error) {
			console.error('Error toggling wallet status:', error);
			alert('Failed to update wallet status');
		}
	}

	// Preview parsed addresses
	function previewAddresses(addressText: string) {
		const parsed = parseWalletInput(addressText);
		const formatted = formatWalletsForStorage(parsed);
		return formatted;
	}

	// Get preview for current input
	$: addressPreview = newWalletAddresses ? previewAddresses(newWalletAddresses) : [];
	$: editPreview = editAddresses ? previewAddresses(editAddresses) : [];
</script>

<div class="modal-overlay" transition:fade={{ duration: 200 }}>
	<div class="modal-container rounded-md shadow-lg bg-white dark:bg-gray-800 max-w-4xl">
		<div class="modal-header flex justify-between items-center p-4 border-b dark:border-gray-700">
			<h2 class="text-xl font-bold m-0 dark:text-gray-100">User Wallets</h2>
			<button class="close-button text-2xl leading-none dark:text-gray-300" on:click={onClose}
				>&times;</button
			>
		</div>

		<div class="modal-body p-4 max-h-[80vh] overflow-y-auto">
			<!-- Add New Wallet Form -->
			<div class="add-wallet-form mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
				<h3 class="text-lg font-semibold mb-2 dark:text-gray-100">Add New Wallet Set</h3>
				<form on:submit|preventDefault={handleSubmit} class="space-y-4">
					<div class="form-group">
						<label for="wallet-name" class="block mb-1 dark:text-gray-300">Name (Optional)</label>
						<input
							type="text"
							id="wallet-name"
							bind:value={newWalletName}
							placeholder="e.g. My Primary Wallets"
							class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
							disabled={isSubmitting}
						/>
					</div>

					<div class="form-group">
						<label for="wallet-addresses" class="block mb-1 dark:text-gray-300">
							Wallet Addresses (one per line or comma-separated)
						</label>
						<textarea
							id="wallet-addresses"
							bind:value={newWalletAddresses}
							placeholder="0x1234...&#10;tz1ABC...&#10;0x5678..."
							rows="4"
							class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
							required
							disabled={isSubmitting}
						></textarea>
					</div>

					<!-- Address Preview -->
					{#if addressPreview.length > 0}
						<div class="preview-section p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
							<h4 class="text-sm font-semibold mb-2 dark:text-gray-200">Preview ({addressPreview.length} addresses):</h4>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
								{#each addressPreview as wallet}
									<div class="flex items-center space-x-2">
										<span class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
											{getBlockchainDisplayName(wallet.blockchain)}
										</span>
										<span class="font-mono text-xs truncate dark:text-gray-300">{wallet.address}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="text-right">
						<button
							type="submit"
							class="primary button mt-0"
							disabled={isSubmitting || !newWalletAddresses.trim()}
						>
							{isSubmitting ? 'Adding...' : 'Add Wallet Set'}
						</button>
					</div>
				</form>
			</div>

			<!-- Saved Wallets -->
			{#if userWallets.length > 0}
				<div class="saved-wallets">
					<h3 class="text-lg font-semibold mb-2 dark:text-gray-100">Saved Wallet Sets</h3>
					<div class="space-y-4">
						{#each userWallets as wallet}
							<div class="wallet-card p-4 border dark:border-gray-600 rounded-md {wallet.enabled ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700 opacity-75'}">
								{#if editingWallet?.id === wallet.id}
									<!-- Edit Mode -->
									<form on:submit|preventDefault={handleUpdate} class="space-y-4">
										<div class="form-group">
											<label class="block mb-1 dark:text-gray-300">Name</label>
											<input
												type="text"
												bind:value={editName}
												placeholder="Wallet set name"
												class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
												disabled={isSubmitting}
											/>
										</div>

										<div class="form-group">
											<label class="block mb-1 dark:text-gray-300">Addresses</label>
											<textarea
												bind:value={editAddresses}
												rows="4"
												class="w-full p-2 border dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-100"
												required
												disabled={isSubmitting}
											></textarea>
										</div>

										<!-- Edit Preview -->
										{#if editPreview.length > 0}
											<div class="preview-section p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
												<h4 class="text-sm font-semibold mb-2 dark:text-gray-200">Preview ({editPreview.length} addresses):</h4>
												<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
													{#each editPreview as w}
														<div class="flex items-center space-x-2">
															<span class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
																{getBlockchainDisplayName(w.blockchain)}
															</span>
															<span class="font-mono text-xs truncate dark:text-gray-300">{w.address}</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										<div class="flex space-x-2">
											<button
												type="submit"
												class="primary button"
												disabled={isSubmitting || !editAddresses.trim()}
											>
												{isSubmitting ? 'Saving...' : 'Save Changes'}
											</button>
											<button
												type="button"
												class="secondary button"
												on:click={cancelEdit}
												disabled={isSubmitting}
											>
												Cancel
											</button>
										</div>
									</form>
								{:else}
									<!-- View Mode -->
									<div class="flex justify-between items-start mb-3">
										<div>
											<h4 class="font-semibold dark:text-gray-100">
												{wallet.name || `Wallet Set ${wallet.id}`}
											</h4>
											<p class="text-sm text-gray-600 dark:text-gray-400">
												{wallet.wallets.length} addresses • Created {new Date(wallet.createdAt).toLocaleDateString()}
											</p>
										</div>
										<div class="flex items-center space-x-2">
											<button
												class="toggle-button px-3 py-1 text-sm rounded-md {wallet.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'}"
												on:click={() => toggleEnabled(wallet)}
											>
												{wallet.enabled ? 'Enabled' : 'Disabled'}
											</button>
											<button
												class="edit-button px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
												on:click={() => startEdit(wallet)}
											>
												Edit
											</button>
											<button
												class="delete-button px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
												on:click={() => handleDelete(wallet.id)}
											>
												Delete
											</button>
										</div>
									</div>

									<!-- Wallet Addresses -->
									<div class="addresses-grid grid grid-cols-1 md:grid-cols-2 gap-2">
										{#each wallet.wallets as w}
											<div class="address-item flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-600 rounded-md">
												<span class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
													{getBlockchainDisplayName(w.blockchain)}
												</span>
												<span class="font-mono text-xs truncate dark:text-gray-300" title={w.address}>
													{w.address}
												</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
					<p class="no-wallets text-gray-600 dark:text-gray-400">No wallet sets created yet.</p>
					<p class="text-sm text-gray-500 dark:text-gray-500 mt-1">
						Create a wallet set to organize multiple addresses for importing NFTs.
					</p>
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
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-container {
		width: 100%;
		max-width: 800px;
		max-height: 90vh;
		overflow: hidden;
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

	.button {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	.primary {
		background-color: #3b82f6;
		color: white;
	}

	.primary:hover:not(:disabled) {
		background-color: #2563eb;
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.secondary {
		background-color: #6b7280;
		color: white;
	}

	.secondary:hover:not(:disabled) {
		background-color: #4b5563;
	}

	.secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style> 