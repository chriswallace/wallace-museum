<script>
	import Modal from '$lib/components/Modal.svelte';

	export let title;
	export let nfts = [];
	export let onClose;
	export let onCompleteImport;
</script>

<Modal {title} {onClose} width="96%">
	<table class="nft-review-table">
		<thead>
			<tr>
				<th></th>
				<th>Title</th>
				<th>Artist</th>
				<th>Collection</th>
			</tr>
		</thead>
		<tbody>
			{#each nfts as nft}
				<tr class="nft-card">
					<td><img src={nft.image_url} alt={nft.name} width="100" /></td>
					<td>{nft.name}</td>
					<td>{nft.artist?.username} ({nft.artist?.address})</td>
					<td>{nft.collection?.name}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="4">
					<div class="split-confirm">
						<p>Ready to complete the import?</p>
						<button class="primary button" on:click={onCompleteImport}>Complete Import</button>
					</div>
				</td>
			</tr>
		</tfoot>
	</table></Modal
>

<style lang="scss">
	table {
		width: 100%;
		border-collapse: collapse;
		color: #777;
	}
	thead {
		background: #d5d9dc;
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

		&:first-child {
			@apply w-[16%];
			font-weight: bold;
		}
		&:nth-child(2) {
			@apply w-[28%];
		}
		&:nth-child(3) {
			@apply w-[28%];
		}
		&:nth-child(4n) {
			@apply w-[28%];
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

	img {
		aspect-ratio: 1 / 1;
		object-fit: cover;
	}

	.split-confirm {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.input {
		@apply truncate;
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
