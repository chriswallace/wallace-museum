<script>
	import Modal from './Modal.svelte';

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
				<th>Address</th>
				<th>Name</th>
				<th>Bio</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item, index}
				<tr>
					<td>
						<div class="address">{item.address}</div>
					</td>
					<td>
						{#if editableIndex === index}
							<textarea bind:value={item.username}></textarea>
						{:else}
							<div class="name">{item.username}</div>
						{/if}
					</td>
					<td>
						{#if editableIndex === index}
							<textarea bind:value={item.bio}></textarea>
						{:else}
							{item.bio}
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
		table-layout: fixed; /* Apply fixed layout to the whole table */
	}

	thead,
	tbody,
	tfoot {
		display: table; /* Ensure thead and tfoot are also treated as table for alignment */
		width: 100%; /* Ensure full width */
	}

	tbody {
		display: block;
		max-height: 64vh;
		overflow-y: scroll;
	}

	th,
	td {
		padding: 8px;
		text-align: left;
		font-size: 14px;
		border-bottom: 1px solid #ddd; /* Added for visual consistency */
	}

	/* Specific column widths */
	th:first-child,
	td:first-child {
		width: 25%;
	}
	th:nth-child(2),
	td:nth-child(2) {
		width: 20%;
	}
	th:nth-child(3),
	td:nth-child(3) {
		width: 30%;
	}
	th:nth-child(4),
	td:nth-child(4) {
		width: 25%;
		text-align: center;
	}

	td {
		&:nth-child(4n) {
			text-align: center;

			button {
				@apply inline py-2 px-3 m-0;
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

	.address,
	.name {
		@apply break-all;
	}

	input[type='text'],
	textarea {
		border: 1px solid gray;
		padding: 4px;
	}

	textarea {
		@apply h-[6em] mb-0 block;

		&:disabled {
			@apply bg-gray-100 border-transparent;
		}
	}
</style>
