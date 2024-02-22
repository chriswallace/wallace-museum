<script>
	import { isLoading } from '$lib/stores';
	export let title;
	export let onClose; // Ensure this function is passed as a prop
	export let width = "500px"; // Default width

	function handleBackdropClick(event) {
		// Prevent modal content click from closing the modal
		if (event.target === event.currentTarget) {
			onClose(); // Use the onClose function passed as a prop
		}
	}
</script>

<div class="modal" on:click={handleBackdropClick}>
	<div class="modal-container" style="width: {width};">
		{#if $isLoading}
			<div class="loading">
				<img src="/images/loading.png" alt="Loading" />
			</div>
		{:else}
			<div class="modal-header">
				<h2>{title}</h2>
				<button class="close-button" on:click={onClose}>✖</button>
			</div>
			<div class="modal-content">
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
	.modal-container {
		@apply rounded-lg;
	}
	.loading {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		background-color: white;

		img {
			width: 40px;
			height: 40px;
		}
	}
	.modal-header {
		padding: 4vh 2rem 2vh;
		display: flex;
		justify-content: space-between;
		align-items: end;
		background: #fff;
		position: relative;

		h2 {
			font-size: 24px;
			font-weight: normal;
		}
	}
	.modal-content {
		background: white;
		padding: 2vh 2rem 4vh;
		max-height: 100vh;
		overflow-y: auto;
		display: flex;
	}
	.close-button {
		margin-top: 0;
		position: absolute;
		top: 0;
		right: 0;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 20px;
		height: 48px;
		width: 48px;
		line-height: 0;
		z-index: 100;
		background:white;
	}
</style>
