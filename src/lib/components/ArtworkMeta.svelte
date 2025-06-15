<script>
	import { formatDate } from '$lib/dateFormatter.js';
	import { getContractUrl, getContractName } from '$lib/utils';
	export let artwork;
</script>

<div class="additional-meta">
	{#if artwork.supply}
		<div class="non-editable">
			<h3>Edition</h3>
			<p>1 of {artwork.supply}</p>
		</div>
	{/if}
	<div class="non-editable">
		<h3>Token ID</h3>
		<p class="truncate">{artwork.tokenId || artwork.tokenID}</p>
	</div>
	<div class="non-editable">
		<h3>Blockchain</h3>
		<p>{artwork.blockchain}</p>
	</div>
	<div class="non-editable">
		<h3>Token Standard</h3>
		<p>{artwork.tokenStandard?.toUpperCase()}</p>
	</div>
	<div class="non-editable">
		<h3>Contract</h3>
		<p>
			{#if getContractUrl(artwork.contractAddress || artwork.contractAddr, artwork.blockchain, artwork.tokenId || artwork.tokenID)}
				<a
					href={getContractUrl(artwork.contractAddress || artwork.contractAddr, artwork.blockchain, artwork.tokenId || artwork.tokenID)}
					target="_blank"
					rel="noopener noreferrer"
				>
					{getContractName(artwork.contractAddress || artwork.contractAddr, artwork.contractAlias)}
				</a>
			{:else}
				{getContractName(artwork.contractAddress || artwork.contractAddr, artwork.contractAlias)}
			{/if}
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
		@apply grid grid-cols-2 gap-4 mt-4 text-base;
	}

	.additional-meta h3 {
		@apply mb-1 text-sm tracking-wide font-normal uppercase;
	}

	.additional-meta a {
		@apply text-gray-600;
	}
</style>
