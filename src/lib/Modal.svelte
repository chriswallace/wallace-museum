<script>
	import { isLoading } from '$lib/stores';
	export let title;
	export let onClose; // Ensure this function is passed as a prop

	function handleBackdropClick(event) {
		// Prevent modal content click from closing the modal
		if (event.target === event.currentTarget) {
			onClose(); // Use the onClose function passed as a prop
		}
	}
</script>

<div class="modal" on:click={handleBackdropClick}>
	<div class="modal-container">
		<button class="close-button" on:click={onClose}>✖</button>
		{#if $isLoading}
			<div class="loading">
				<img src="/images/loading.png" alt="Loading" />
			</div>
		{:else}
			<div class="modal-header">
				<h2>{title}</h2>
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
		@apply absolute;
		top: 2vh;
		bottom: 2vh;
		left: 2vh;
		right: 2vh;
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
		top: 10px;
		right: 10px;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 25px;
		z-index: 100;
	}
</style>
