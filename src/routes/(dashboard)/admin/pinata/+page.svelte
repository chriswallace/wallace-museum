<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from '@zerodevx/svelte-toast';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';

	// Get data from server
	export let data;
	export let form;

	// State variables
	let pins = data.pins || [];
	let totalPins = data.totalPins || 0;
	let isLoading = false;
	let currentPage = data.currentPage || 0;
	let pageSize = data.pageSize || 50;
	let cidInput = '';
	let pinataGateway = data.pinataGateway || 'https://gateway.pinata.cloud/ipfs/';

	// Format the date for display
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	// Format file size for display
	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Handle pagination by navigating to the page with the correct params
	function nextPage() {
		if ((currentPage + 1) * pageSize < totalPins) {
			navigateToPage(currentPage + 1);
		}
	}

	function prevPage() {
		if (currentPage > 0) {
			navigateToPage(currentPage - 1);
		}
	}

	function navigateToPage(page: number): void {
		const url = new URL(window.location.href);
		url.searchParams.set('offset', String(page * pageSize));
		url.searchParams.set('limit', String(pageSize));
		goto(url.toString());
	}

	function refreshPage(): void {
		goto(window.location.href, { invalidateAll: true });
	}

	// Show pin dialog
	function showPinDialog(): void {
		const dialog = document.getElementById('pin-dialog') as HTMLDialogElement;
		if (dialog) {
			dialog.showModal();
		}
	}

	// Close pin dialog
	function closeDialog(): void {
		const dialog = document.getElementById('pin-dialog') as HTMLDialogElement;
		if (dialog) {
			dialog.close();
		}
	}

	// Display form results
	$: if (form?.success && form?.result) {
		toast.push(`Successfully pinned CID: ${form.result.IpfsHash}`);
		cidInput = '';
		closeDialog();
	} else if (form?.error) {
		toast.push(`Error: ${form.error}`);
	}

	// Display error if there was one
	$: if (data.error) {
		toast.push(`Error: ${data.error}`);
	}
</script>

<div class="px-4 py-6">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-bold mb-2">Pinata IPFS Management</h1>
			<p class="text-gray-600 dark:text-gray-400">
				View and manage your pinned IPFS content on Pinata.
			</p>
		</div>

		<div class="flex items-center gap-4">
			<button class="secondary button py-2 px-4" on:click={showPinDialog}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 mr-1 inline"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Pin New CID
			</button>
			<button class="primary button py-2 px-4" on:click={refreshPage}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 mr-1 inline"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh
			</button>
		</div>
	</div>

	<!-- Pins Table -->
	<div class="bg-white dark:bg-gray-800 rounded-md shadow-sm overflow-hidden">
		{#if isLoading}
			<div class="p-8 text-center">
				<div
					class="inline-block animate-spin h-8 w-8 border-2 border-gray-500 border-t-transparent rounded-full"
				></div>
				<p class="text-gray-600 dark:text-gray-400 mt-2">Loading pins...</p>
			</div>
		{:else if pins.length === 0}
			<div class="p-8 text-center">
				<p class="text-gray-600 dark:text-gray-400">No pins found.</p>
				<button class="secondary button py-2 px-4 mt-4" on:click={showPinDialog}>Pin New CID</button
				>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full border-collapse">
					<thead>
						<tr class="bg-gray-50 dark:bg-gray-700">
							<th class="p-3 text-left dark:text-gray-300">Name</th>
							<th class="p-3 text-left dark:text-gray-300">CID</th>
							<th class="p-3 text-left dark:text-gray-300">Size</th>
							<th class="p-3 text-left dark:text-gray-300">Date Pinned</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each pins as pin}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
								<td class="p-3 dark:text-gray-300">
									{pin.metadata?.name || 'Unnamed Pin'}
								</td>
								<td class="p-3 font-mono text-sm dark:text-gray-300">
									<a
										href={`${pinataGateway}${pin.ipfs_pin_hash}`}
										target="_blank"
										rel="noopener noreferrer"
										class="text-blue-600 dark:text-blue-400 hover:underline"
									>
										{pin.ipfs_pin_hash.substring(0, 16)}...
									</a>
								</td>
								<td class="p-3 dark:text-gray-300">{formatSize(pin.size)}</td>
								<td class="p-3 dark:text-gray-300">{formatDate(pin.date_pinned)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div class="p-4 flex justify-between items-center border-t dark:border-gray-700">
				<div class="text-gray-600 dark:text-gray-400">
					Showing {currentPage * pageSize + 1} to {Math.min(
						(currentPage + 1) * pageSize,
						totalPins
					)} of {totalPins} pins
				</div>
				<div class="flex gap-2">
					<button
						class="secondary button py-1 px-3"
						on:click={prevPage}
						disabled={currentPage === 0}
					>
						Previous
					</button>
					<button
						class="secondary button py-1 px-3"
						on:click={nextPage}
						disabled={(currentPage + 1) * pageSize >= totalPins}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Pin CID Dialog -->
<dialog id="pin-dialog" class="p-0 rounded-lg shadow-xl bg-white dark:bg-gray-800 w-full max-w-md">
	<div class="p-6">
		<h3 class="text-xl font-bold mb-4 dark:text-gray-100">Pin New IPFS CID</h3>
		<form method="POST" action="?/pinCid" use:enhance>
			<div class="mb-4">
				<label for="cid" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>CID or IPFS URL</label
				>
				<input
					id="cid"
					name="cid"
					type="text"
					bind:value={cidInput}
					class="w-full p-2 border dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-gray-100"
					placeholder="Qm... or ipfs://Qm... or https://gateway.io/ipfs/Qm..."
					required
				/>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
					Enter a CID or any IPFS URL format
				</p>
			</div>

			<div class="flex justify-end gap-3 mt-6">
				<button type="button" class="secondary button py-2 px-4" on:click={closeDialog}>
					Cancel
				</button>
				<button type="submit" class="primary button py-2 px-4"> Pin CID </button>
			</div>
		</form>
	</div>
</dialog>

<style>
	.button {
		@apply rounded-md font-medium transition-colors;
	}

	.primary.button {
		@apply bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600;
	}

	.secondary.button {
		@apply bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600;
	}

	button:disabled {
		@apply opacity-50 cursor-not-allowed;
	}

	dialog {
		border: none;
	}

	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
	}
</style>
