<script>
	export let onClose;

	function handleBackdropClick(event) {
		// Prevent modal content click from closing the modal
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<div class="modal-backdrop" on:click={handleBackdropClick}>
	<div class="modal-content">
		<button class="close-button" on:click={onClose}>✖</button>
		<slot />
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 1000;
	}

	.modal-content {
		background: white;
		padding: 20px;
		border-radius: 5px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		position: relative;
		z-index: 1001;
	}

	.close-button {
		position: absolute;
		top: 10px;
		right: 10px;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 20px;
	}
</style>
