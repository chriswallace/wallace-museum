<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getContractUrl, getContractName, truncateAddress } from '$lib/utils';
	import { linear } from 'svelte/easing';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtworkDisplay from '$lib/components/ArtworkDisplay.svelte';

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

	function parseAndJoinTags(tags: any): string {
		if (typeof tags === 'string') {
			try {
				const parsedTags = JSON.parse(tags);
				if (Array.isArray(parsedTags)) {
					return parsedTags.join(', ');
				}
			} catch (e) {
				console.error('Error parsing tags:', e);
				return ''; // Or return the original string, or some error indicator
			}
		} else if (Array.isArray(tags)) {
			return tags.join(', '); // Already an array
		}
		return ''; // Not a string or an array
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

	$: pageTitle = data.artist
		? `${data.artist.name} | Wallace Museum`
		: data.error
			? 'Artist Not Found | Wallace Museum'
			: 'Loading Artist | Wallace Museum';

	// Transform artwork data to match ArtworkDisplay component interface
	$: currentArtworkForDisplay = currentArtwork ? {
		generatorUrl: currentArtwork.generator_url || currentArtwork.generatorUrl,
		animationUrl: currentArtwork.animation_url || currentArtwork.animationUrl,
		imageUrl: currentArtwork.image_url || currentArtwork.imageUrl,
		thumbnailUrl: currentArtwork.thumbnail_url || currentArtwork.thumbnailUrl,
		mime: currentArtwork.mime,
		title: currentArtwork.title,
		dimensions: currentArtwork.dimensions
	} : null;
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content={data.artist
			? `Explore artworks by ${data.artist.name} at the Wallace Museum`
			: 'Artist gallery at the Wallace Museum'}
	/>
</svelte:head>

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
						{#if currentArtworkForDisplay}
							<ArtworkDisplay 
								artwork={currentArtworkForDisplay}
								size="fullscreen"
								showLoader={true}
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

							<div class="content-grid">
								{#if data.artist.artworks[currentIndex].description}
									<div class="description-col">
										<div class="museum-description">
											{data.artist.artworks[currentIndex].description}
										</div>
									</div>
								{/if}

								<div class="metadata-col">
									{#if data.artist.artworks[currentIndex].attributes && data.artist.artworks[currentIndex].attributes.length}
										<div class="metadata-section">
											<h3 class="metadata-heading">Attributes</h3>
											<div class="metadata-grid">
												{#each parseAttributes(data.artist.artworks[currentIndex].attributes) as attribute}
													<div class="metadata-item">
														<strong>{attribute.trait_type}</strong>
														<span>{attribute.value}</span>
													</div>
												{/each}
											</div>
										</div>

										<div class="divider" />
									{/if}

									<div class="metadata-section">
										<div class="metadata-grid">
											{#if currentDimensions}
												<div class="metadata-item">
													<strong>Dimensions</strong>
													<span>{dimensionsObj.width} × {dimensionsObj.height}</span>
												</div>
											{/if}
											{#if data.artist.artworks[currentIndex].contractAddr}
												<div class="metadata-item">
													<strong>Contract</strong>
													{#if getContractUrl(data.artist.artworks[currentIndex].contractAddr, data.artist.artworks[currentIndex].blockchain, data.artist.artworks[currentIndex].tokenID)}
														<a
															href={getContractUrl(
																data.artist.artworks[currentIndex].contractAddr,
																data.artist.artworks[currentIndex].blockchain,
																data.artist.artworks[currentIndex].tokenID
															)}
															target="_blank"
															rel="noopener noreferrer"
															class="contract-link"
														>
															{getContractName(
																data.artist.artworks[currentIndex].contractAddr,
																data.artist.artworks[currentIndex].contractAlias
															)}
														</a>
													{:else}
														<span>
															{getContractName(
																data.artist.artworks[currentIndex].contractAddr,
																data.artist.artworks[currentIndex].contractAlias
															)}
														</span>
													{/if}
												</div>
											{/if}
											{#if data.artist.artworks[currentIndex].contractAlias && !data.artist.artworks[currentIndex].contractAddr}
												<div class="metadata-item">
													<strong>Contract Alias</strong>
													<span>{data.artist.artworks[currentIndex].contractAlias}</span>
												</div>
											{/if}
											{#if data.artist.artworks[currentIndex].tokenID}
												<div class="metadata-item">
													<strong>Token ID</strong>
													<span>{data.artist.artworks[currentIndex].tokenID}</span>
												</div>
											{/if}
											{#if data.artist.artworks[currentIndex].tokenStandard}
												<div class="metadata-item">
													<strong>Token Standard</strong>
													<span>{data.artist.artworks[currentIndex].tokenStandard?.toUpperCase()}</span>
												</div>
											{/if}

											{#if data.artist.artworks[currentIndex].mintDate}
												<div class="metadata-item">
													<strong>Mint Date</strong>
													<span>{formatMintDate(data.artist.artworks[currentIndex].mintDate)}</span>
												</div>
											{/if}
											{#if data.artist.artworks[currentIndex].mime}
												<div class="metadata-item">
													<strong>Medium</strong>
													<span>{formatMedium(data.artist.artworks[currentIndex].mime)}</span>
												</div>
											{/if}
											{#if data.artist.artworks[currentIndex].tags && data.artist.artworks[currentIndex].tags.length}
												<div class="metadata-item">
													<strong>Tags</strong>
													<span>{parseAndJoinTags(data.artist.artworks[currentIndex].tags)}</span>
												</div>
											{/if}
											{#if data.artist.addresses && data.artist.addresses.length > 0}
												<div class="metadata-item">
													<strong>Artist Addresses</strong>
													<div class="flex flex-col gap-1 mt-1">
														{#each data.artist.addresses as address}
															<div class="flex items-center justify-between">
																<span class="text-sm">
																	{address.blockchain}:
																	<span class="font-mono" title={address.address}>{truncateAddress(address.address)}</span>
																</span>
																{#if getContractUrl(address.address, address.blockchain)}
																	<a
																		href={getContractUrl(address.address, address.blockchain)}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="text-blue-400 hover:text-blue-300 text-sm ml-2"
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
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/key}
		{/if}
	</div>
{/if}

<style lang="scss">
	.artist-page {
		@apply w-full min-h-screen bg-black bg-opacity-80;
	}

	.close-button {
		@apply text-3xl text-gray-400 hover:text-white bg-transparent border-none cursor-pointer absolute top-3 right-6 z-50;
	}

	.museum-content {
		@apply flex flex-col w-full items-center justify-start;
		padding: 1rem 0;
	}

	.artwork-container {
		@apply flex items-center justify-center bg-black bg-opacity-50 rounded-lg p-4;
		width: 100%;
		max-width: 1400px;
		height: 80svh;
		margin-bottom: 2rem;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
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
		@apply px-4 md:px-6 w-full mx-auto;
		max-width: 1400px;
		min-height: 300px;
	}

	.museum-details-overlay {
		@apply flex flex-col gap-6 w-full md:px-6 py-6 mx-auto bg-black bg-opacity-50 rounded-lg relative mt-0;
	}

	.museum-header {
		@apply flex justify-between items-start mb-0 min-h-[70px];
	}

	.museum-artist-title {
		@apply flex-1 pr-4;
	}

	.museum-artist {
		@apply text-sm font-medium uppercase tracking-wider text-yellow-500 mb-1;
	}

	.museum-title {
		@apply text-2xl font-bold text-white leading-tight max-w-[900px];
	}

	.artwork-navigation {
		@apply flex items-center gap-2 ml-4;
	}

	.nav-button {
		@apply flex items-center justify-center w-10 h-10 text-white bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full border-none cursor-pointer;
	}

	.content-grid {
		@apply grid grid-cols-1 gap-8;
		@apply md:grid-cols-[minmax(600px,800px)_minmax(300px,400px)];
	}

	.description-col {
		@apply md:pr-12 w-full;
	}

	.metadata-col {
		@apply flex flex-col gap-8 w-full;
	}

	.museum-description {
		@apply text-base text-gray-300;
		max-width: 65ch;
	}

	.museum-meta {
		@apply text-sm text-gray-400 list-none m-0 flex flex-col gap-4 rounded-lg;
	}

	.metadata-grid {
		@apply grid gap-6;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
	}

	.metadata-item {
		@apply flex flex-col gap-1;
		min-width: 0;

		&.full-width {
			grid-column: 1 / -1;
		}

		strong {
			@apply text-xs uppercase tracking-wider text-gray-400;
		}

		span,
		a {
			@apply text-sm text-gray-100;
			word-break: break-word;
		}
	}

	.attributes-list {
		@apply gap-0.5 grid grid-cols-3 border border-gray-700 rounded-md p-4 w-full;
	}

	.attribute-item {
		@apply rounded-md p-0.5 flex flex-col items-start;

		dt {
			@apply text-xs uppercase tracking-wider text-gray-400 min-w-[170px];
		}

		dd {
			@apply text-sm text-gray-200 m-0 text-left;
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

	.metadata-section {
		@apply flex flex-col gap-4;
	}

	.metadata-heading {
		@apply text-lg font-semibold text-white;
	}

	.divider {
		@apply w-full h-px bg-gray-700 my-6;
	}

</style>
