<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';

	export let data: { artist?: any; error?: string };

	interface Attribute {
		trait_type?: string;
		value: string;
	}

	let currentIndex = 0;
	let iframeEl: HTMLIFrameElement | null = null;

	function formatMintDate(dateStr: string | Date | undefined): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			timeZoneName: 'short'
		}).format(date);
	}

	function getContractUrl(contractAddr: string, tokenId?: string): string | undefined {
		if (contractAddr.startsWith('KT')) {
			// Tezos contract
			return tokenId
				? `https://tzkt.io/${contractAddr}/tokens/${tokenId}`
				: `https://tzkt.io/${contractAddr}`;
		} else if (contractAddr.startsWith('0x')) {
			// Ethereum contract
			return tokenId
				? `https://etherscan.io/token/${contractAddr}?a=${tokenId}`
				: `https://etherscan.io/token/${contractAddr}`;
		}
		return undefined;
	}

	function closeOverlay() {
		goto('/');
	}

	function nextArtwork() {
		if (!data.artist) return;
		currentIndex = (currentIndex + 1) % data.artist.artworks.length;
	}

	function prevArtwork() {
		if (!data.artist) return;
		currentIndex = (currentIndex - 1 + data.artist.artworks.length) % data.artist.artworks.length;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeOverlay();
		if (event.key === 'ArrowRight') nextArtwork();
		if (event.key === 'ArrowLeft') prevArtwork();
	}

	function handleIframeLoad() {
		if (iframeEl && iframeEl.contentWindow) {
			try {
				const styleElement = iframeEl.contentDocument?.createElement('style');
				if (styleElement) {
					styleElement.textContent = `
					html, body {
						overflow: hidden !important;
						margin: 0 !important;
						padding: 0 !important;
						height: 100% !important;
						width: 100% !important;
					}
					::-webkit-scrollbar {
						display: none !important;
					}
					* {
						scrollbar-width: none !important;
					}
				`;
					iframeEl.contentDocument?.head?.appendChild(styleElement);
				}
			} catch (e) {
				console.log('Could not modify iframe content due to cross-origin restrictions');
			}
		}
	}

	function formatMedium(mime?: string): string {
		if (!mime) return 'Digital Artwork';

		// Handle image types
		if (mime.startsWith('image/')) {
			return 'Digital Image';
		}

		// Handle video types
		if (mime.startsWith('video/')) {
			return 'Digital Video';
		}

		// Handle interactive/code works
		if (
			mime === 'application/x-directory' ||
			mime.startsWith('text/') ||
			mime.includes('javascript') ||
			mime.includes('html')
		) {
			return 'Interactive Digital Artwork';
		}

		// Handle other application types
		if (mime.startsWith('application/')) {
			return 'Digital Artwork';
		}

		return 'Digital Artwork';
	}

	function parseAttributes(
		attributes: string | any[] | null | undefined
	): { trait_type: string; value: string }[] {
		if (!attributes) return [];
		if (Array.isArray(attributes)) return attributes;
		try {
			const parsed = JSON.parse(attributes);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	$: currentArtwork = data.artist?.artworks?.[currentIndex];
	$: currentDimensions = currentArtwork?.dimensions;
	$: dimensionsObj = currentDimensions
		? typeof currentDimensions === 'string'
			? JSON.parse(currentDimensions)
			: currentDimensions
		: { width: 16, height: 9 };
	$: aspectRatio = `${dimensionsObj.width} / ${dimensionsObj.height}`;

	$: currentAttributes =
		data.artist &&
		data.artist.artworks[currentIndex] &&
		data.artist.artworks[currentIndex].attributes
			? parseAttributes(data.artist.artworks[currentIndex].attributes)
					.map((a) => `${a.trait_type}: ${a.value}`)
					.join(', ')
			: '';
</script>

{#if !data.artist && data.error}
	<div class="artist-page" transition:fade>
		<div class="artist-content">
			<button class="close-button" on:click={closeOverlay} aria-label="Close artist gallery"
				>×</button
			>
			<h2 class="artist-overlay-title">Artist Not Found</h2>
			<p class="text-gray-300 mb-4">{data.error}</p>
		</div>
	</div>
{:else if !data.artist}
	<div class="artist-page" transition:fade>
		<div class="artist-content">
			<div class="flex flex-col items-center justify-center min-h-[200px]">
				<div class="loader mb-4" />
				<p class="text-gray-300">Loading artist...</p>
			</div>
		</div>
	</div>
{:else}
	<div class="artist-page" role="main" on:keydown={handleKeyDown} transition:fade>
		<button class="close-button" on:click={closeOverlay} aria-label="Close artist gallery">×</button
		>

		{#if data.artist.artworks.length > 0}
			{#key currentIndex}
				<div class="museum-content">
					<div class="artwork-container">
						{#if currentArtwork.animation_url && currentArtwork.mime && currentArtwork.mime.startsWith('video')}
							<video
								src={currentArtwork.animation_url}
								autoplay
								loop
								muted
								playsinline
								class="artwork-media"
							/>
						{:else if currentArtwork.animation_url && currentArtwork.mime && (currentArtwork.mime.startsWith('application') || currentArtwork.mime.startsWith('text'))}
							<div class="iframe-container" style="aspect-ratio: {aspectRatio}">
								<iframe
									bind:this={iframeEl}
									on:load={handleIframeLoad}
									src={currentArtwork.animation_url}
									width="100%"
									height="100%"
									title="Artwork Animation"
									class="artwork-iframe"
									scrolling="no"
									frameborder="0"
									sandbox="allow-scripts allow-same-origin"
									allowfullscreen
								/>
							</div>
						{:else if currentArtwork.image_url}
							<img
								src={getCloudinaryTransformedUrl(currentArtwork.image_url, 'w_2000,q_90,f_auto')}
								alt={currentArtwork.title}
								class="artwork-media"
							/>
						{/if}
					</div>

					<div class="museum-details-wrapper">
						<div class="museum-details-overlay">
							<div class="museum-header">
								<div class="museum-artist-title">
									<div class="museum-artist">{data.artist.name}</div>
									<div class="museum-title">{data.artist.artworks[currentIndex].title}</div>
								</div>

								{#if data.artist.artworks.length > 1}
									<div class="artwork-navigation">
										<button class="nav-button" on:click={prevArtwork} aria-label="Previous artwork"
											>←</button
										>
										<button class="nav-button" on:click={nextArtwork} aria-label="Next artwork"
											>→</button
										>
									</div>
								{/if}
							</div>

							{#if data.artist.artworks[currentIndex].description}
								<div class="museum-description">
									{data.artist.artworks[currentIndex].description}
								</div>
							{/if}

							<ul class="museum-meta">
								<div class="metadata-grid">
									{#if currentDimensions}
										<li>
											<strong>Dimensions</strong>
											<span>{dimensionsObj.width} × {dimensionsObj.height}</span>
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].contractAddr}
										<li>
											<strong>Contract</strong>
											{#if getContractUrl(data.artist.artworks[currentIndex].contractAddr, data.artist.artworks[currentIndex].tokenID)}
												<a
													href={getContractUrl(
														data.artist.artworks[currentIndex].contractAddr,
														data.artist.artworks[currentIndex].tokenID
													)}
													target="_blank"
													rel="noopener noreferrer"
													class="contract-link"
												>
													{data.artist.artworks[currentIndex].contractAlias ||
														data.artist.artworks[currentIndex].contractAddr}
												</a>
											{:else}
												<span>
													{data.artist.artworks[currentIndex].contractAlias ||
														data.artist.artworks[currentIndex].contractAddr}
												</span>
											{/if}
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].contractAlias && !data.artist.artworks[currentIndex].contractAddr}
										<li>
											<strong>Contract Alias</strong>
											<span>{data.artist.artworks[currentIndex].contractAlias}</span>
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].tokenID}
										<li>
											<strong>Token ID</strong>
											<span>{data.artist.artworks[currentIndex].tokenID}</span>
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].tokenStandard}
										<li>
											<strong>Token Standard</strong>
											<span>{data.artist.artworks[currentIndex].tokenStandard}</span>
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].totalSupply}
										<li>
											<strong>Total Supply</strong>
											<span>{data.artist.artworks[currentIndex].totalSupply}</span>
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].mintDate}
										<li>
											<strong>Mint Date</strong>
											<span>{formatMintDate(data.artist.artworks[currentIndex].mintDate)}</span>
										</li>
									{/if}
									{#if data.artist.artworks[currentIndex].mime}
										<li>
											<strong>Medium</strong>
											<span>{formatMedium(data.artist.artworks[currentIndex].mime)}</span>
										</li>
									{/if}
								</div>

								{#if data.artist.artworks[currentIndex].tags && data.artist.artworks[currentIndex].tags.length}
									<li class="full-width">
										<strong>Tags</strong>
										<span>{data.artist.artworks[currentIndex].tags.join(', ')}</span>
									</li>
								{/if}

								{#if data.artist.artworks[currentIndex].attributes && data.artist.artworks[currentIndex].attributes.length}
									<li class="full-width">
										<strong>Attributes</strong>
										<dl class="attributes-list">
											{#each parseAttributes(data.artist.artworks[currentIndex].attributes) as attribute}
												<div class="attribute-item">
													<dt>{attribute.trait_type}</dt>
													<dd>{attribute.value}</dd>
												</div>
											{/each}
										</dl>
									</li>
								{/if}
							</ul>
						</div>
					</div>
				</div>
			{/key}
		{/if}

		{#if data.artist.addresses && data.artist.addresses.length > 0}
			<div class="artist-addresses mb-4">
				<h3 class="text-lg font-semibold mb-2">Verified Addresses</h3>
				<div class="grid grid-cols-1 gap-2">
					{#each data.artist.addresses as address}
						<div class="flex items-center justify-between bg-gray-800 p-2 rounded">
							<div class="flex items-center">
								<span class="text-sm text-gray-400 mr-2">{address.blockchain}:</span>
								<span class="font-mono text-sm">{address.address}</span>
							</div>
							{#if getContractUrl(address.address)}
								<a
									href={getContractUrl(address.address)}
									target="_blank"
									rel="noopener noreferrer"
									class="text-blue-400 hover:text-blue-300 text-sm"
								>
									View
								</a>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.artist-page {
		@apply w-full min-h-screen bg-black bg-opacity-80;
	}

	.close-button {
		@apply text-3xl text-gray-400 hover:text-white bg-transparent border-none cursor-pointer absolute top-8 right-8;
	}

	.museum-content {
		@apply flex flex-col w-full items-center justify-start;
		padding: 2rem 0;
	}

	.artwork-container {
		@apply flex items-center justify-center bg-black bg-opacity-50 rounded-lg p-4;
		width: 90%;
		max-width: 1400px;
		height: 70vh;
		margin-bottom: 2rem;
		overflow: hidden;
	}

	.artwork-media {
		@apply object-contain m-auto;
		max-width: 100%;
		max-height: 100%;
	}

	.iframe-container {
		height: 100%;
		width: auto;
		position: relative;
		overflow: hidden;
	}

	.artwork-iframe {
		@apply mx-auto;
		border: none;
		display: block;
		overflow: hidden;
	}

	.museum-details-wrapper {
		@apply w-full px-4 md:px-6 max-w-4xl mx-auto;
		min-height: 300px;
	}

	.museum-details-overlay {
		@apply flex flex-col gap-2 w-full px-4 py-3 mx-auto bg-black bg-opacity-50 rounded-lg relative mt-0;
	}

	.museum-header {
		@apply flex justify-between items-start mb-2;
		height: 70px;
	}

	.museum-artist-title {
		@apply flex-1;
	}

	.museum-artist {
		@apply text-sm font-medium uppercase tracking-wider text-yellow-500 mb-1;
	}

	.museum-title {
		@apply text-2xl font-bold text-white leading-tight;
	}

	.artwork-navigation {
		@apply flex items-center gap-2 ml-4;
	}

	.nav-button {
		@apply flex items-center justify-center w-10 h-10 text-white bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full border-none cursor-pointer;
	}

	.museum-description {
		@apply text-base text-gray-600 mb-2;
	}

	.museum-meta {
		@apply text-sm text-gray-300 list-none p-6 m-0 flex flex-col gap-4 bg-black bg-opacity-40 rounded-lg;
	}

	.metadata-grid {
		@apply grid gap-4;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	}

	.museum-meta li {
		@apply m-0 p-0 flex flex-col gap-1;

		&.full-width {
			@apply col-span-full;
		}

		strong {
			@apply text-xs uppercase tracking-wider text-gray-400 block mb-1;
		}

		span,
		a {
			@apply text-sm text-gray-200;
		}
	}

	.attributes-list {
		@apply grid gap-4 mt-2;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	}

	.attribute-item {
		@apply bg-black bg-opacity-30 rounded-md p-2 grid items-center;
		grid-template-columns: minmax(100px, auto) 1fr;
		gap: 0.5rem;

		dt {
			@apply text-xs uppercase tracking-wider text-gray-400;
		}

		dd {
			@apply text-sm text-gray-200 m-0 text-right;
		}
	}

	.contract-link {
		@apply text-yellow-500 hover:text-yellow-400 transition-colors;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	.loader {
		border: 4px solid #444;
		border-top: 4px solid #fff;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		.artwork-container {
			height: 60vh;
			width: 95%;
		}
	}

	.artist-addresses {
		@apply bg-gray-900 p-4 rounded-lg;
	}
</style>
