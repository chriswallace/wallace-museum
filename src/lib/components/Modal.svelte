<script lang="ts">
	import { isLoading } from '$lib/stores';

	export let title: string;
	export let onClose: () => void; // Properly typed function
	export let width = '500px'; // Default width

	function handleBackdropClick(event: MouseEvent): void {
		// Prevent modal content click from closing the modal
		if (event.target === event.currentTarget) {
			onClose(); // Use the onClose function passed as a prop
		}
	}
</script>

<div class="modal" on:click={handleBackdropClick}>
	<div class="modal-container bg-white dark:bg-gray-800 rounded-lg" style="width: {width};">
		{#if $isLoading}
			<div class="loading bg-white dark:bg-gray-900 flex justify-center items-center h-full">
				<img src="/images/loading.png" alt="Loading" class="w-10 h-10 dark:invert" width="40" height="40" />
			</div>
		{:else}
			<div
				class="modal-header bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-8 pt-16 pb-8 flex justify-between items-end relative"
			>
				<h2 class="text-2xl font-normal">{title}</h2>
				<button
					class="close-button bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 absolute top-0 right-0 border-none cursor-pointer text-xl h-12 w-12 leading-none z-10"
					on:click={onClose}>✖</button
				>
			</div>
			<div
				class="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-8 pb-16 max-h-screen overflow-y-auto flex"
			>
				<slot />
			</div>
		{/if}
	</div>
</div>

<style>
	.modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 100;
	}
</style>
