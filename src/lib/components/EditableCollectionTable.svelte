<script>
	import Modal from '$lib/components/Modal.svelte';

	export let items = []; // items to display and edit, e.g., collections or artists
	export let onSave; // optional callback function to handle saving changes
	export let onNext; // optional callback function to handle saving changes
	export let onClose; // Ensure this function is passed as a prop
	export let title;

	let editableIndex = null; // track which item is currently being edited

	// Function to handle saving edits
	function saveEdit(item, index) {
		// Here you could also call an external save function, passing the modified item
		if (typeof onSave === 'function') {
			onSave(item, index);
		}
		editableIndex = null; // Reset editable index to hide inputs
	}

	// Function to cancel the edit and reset the editable index
	function cancelEdit() {
		editableIndex = null; // Reset editable index to hide inputs
	}
</script>

<Modal {title} {onClose} width="96%">
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Description</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item, index}
				<tr>
					<td>
						{#if editableIndex === index}
							<textarea bind:value={item.name}></textarea>
						{:else}
							{item.name}
						{/if}
					</td>
					<td>
						{#if editableIndex === index}
							<textarea bind:value={item.description}></textarea>
						{:else}
							{item.description}
						{/if}
					</td>
					<td>
						{#if editableIndex === index}
							<button class="primary button" on:click={() => saveEdit(item, index)}>Save</button>
							<button class="delete button" on:click={cancelEdit}>Cancel</button>
						{:else}
							<button class="edit button" on:click={() => (editableIndex = index)}>Edit</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3">
					<button class="primary button" on:click={onNext}>Next</button>
				</td>
			</tr>
		</tfoot>
	</table>
</Modal>

<style lang="scss">
	table {
		width: 100%;
		border-collapse: collapse;
		color: #777;
	}
	thead {
		background: #c7cacd;
		border-radius: 6px 6px 0 0;
		display: table;
		width: 100%;
		height: 4vh;
		table-layout: fixed;

		th {
			border-bottom: 0;
		}
	}
	tbody {
		display: block;
		max-height: 64vh;
		overflow-y: scroll;
		width: 100%;

		tr:nth-child(even) {
			background-color: #f2f2f2;
		}
	}
	th,
	td {
		padding: 8px;
		text-align: left;
		border-bottom: 0;
		font-size: 14px;
		word-break: break-all;

		&:first-child {
			@apply w-[15%];
			font-weight: bold;
		}
		&:nth-child(2) {
			@apply w-[65%];
		}

		&:nth-child(3) {
			@apply w-[20%];
			text-align: center;

			button {
				@apply inline py-2 px-3 m-0;
			}
		}
	}
	th:nth-child(3) {
		@apply text-center;
	}
	td {
		&:nth-child(3n) {
			button {
				@apply mx-auto;
			}
		}
	}
	tfoot td {
		border-bottom: 0;
		text-align: right;
		padding-top: 3vh;

		button {
			margin-left: auto;
		}
	}
	input[type='text'],
	textarea {
		border: 1px solid gray;
		border-radius: 6px;
		padding: 6px 10px;
	}

	textarea {
		@apply h-[6em] mb-0 block;

		&:disabled {
			@apply bg-gray-100 border-transparent;
		}
	}
</style>
