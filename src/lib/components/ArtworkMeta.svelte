<script>
	import { formatDate } from '$lib/dateFormatter.js';
	export let artwork;
</script>

<div class="additional-meta">
	<div class="non-editable">
		<h3>Token ID</h3>
		<p>{artwork.tokenID}</p>
	</div>
	<div class="non-editable">
		<h3>Blockchain</h3>
		<p>{artwork.blockchain}</p>
	</div>
	<div class="non-editable">
		<h3>Token Standard</h3>
		<p>{artwork.tokenStandard}</p>
	</div>
	<div class="non-editable">
		<h3>Contract</h3>
		<p>
			<a href="https://etherscan.io/address/{artwork.contractAddr}">{artwork.contractAlias}</a>
		</p>
	</div>
	<div class="non-editable">
		<h3>Mint Date</h3>
		<p>{formatDate(artwork.mintDate)}</p>
	</div>
</div>

<style>
	.non-editable {
		@apply mb-4;
	}

	.additional-meta {
		@apply grid grid-cols-2 mt-4 text-gray-600 text-base bg-gray-100 border-gray-300;

		h3 {
			@apply mb-1 text-sm tracking-wide font-normal uppercase;
		}

		a {
			@apply text-gray-600;
		}
	}
</style>
