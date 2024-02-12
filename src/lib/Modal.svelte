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
		@apply p-6 pt-16 bg-white rounded-lg shadow-lg relative z-10 w-[95%] max-h-[95%] overflow-y-auto;
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
	}

	:global{
		h1,h2,h3,h4,h5,h6{
			@apply font-medium mb-6;
		}
		table{
			@apply mb-12;
		}
	}
</style>
