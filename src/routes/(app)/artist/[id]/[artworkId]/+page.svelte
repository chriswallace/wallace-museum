<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getContractUrl, getContractName, truncateAddress } from '$lib/utils';
	import { linear } from 'svelte/easing';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtworkDisplay from '$lib/components/ArtworkDisplay.svelte';

	export let data: { 
		artist?: any; 
		currentArtworkId?: string;
		currentIndex?: number;
		error?: string; 
	};

	interface Attribute {
		trait_type?: string;
		value: string;
	}

	let currentIndex = data.currentIndex || 0;
	let iframeEl: HTMLIFrameElement | null = null;
	let isInBrowserFullscreen = false;
	let keyboardHelpVisible = false;
	let fullscreenHintVisible = false;
	let fullscreenHintTimeout: ReturnType<typeof setTimeout>;
	let mainContainer: HTMLElement;

	// Track fullscreen state
	function handleFullscreenChange() {
		const wasFullscreen = isInBrowserFullscreen;
		isInBrowserFullscreen = !!document.fullscreenElement;
		
		// Show hint when entering fullscreen
		if (!wasFullscreen && isInBrowserFullscreen) {
			showFullscreenHint();
		}
		
		// Restore focus after fullscreen change
		setTimeout(() => {
			if (mainContainer) {
				mainContainer.focus();
			}
		}, 100);
	}

	function showFullscreenHint() {
		fullscreenHintVisible = true;
		clearTimeout(fullscreenHintTimeout);
		fullscreenHintTimeout = setTimeout(() => {
			fullscreenHintVisible = false;
		}, 3000);
	}

	// Ensure focus is maintained after navigation
	function restoreFocus() {
		setTimeout(() => {
			if (mainContainer) {
				mainContainer.focus();
			}
		}, 100);
	}

	onMount(() => {
		// Listen for fullscreen changes
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		
		// Set initial focus
		setTimeout(() => {
			if (mainContainer) {
				mainContainer.focus();
			}
		}, 100);
		
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			clearTimeout(fullscreenHintTimeout);
		};
	});

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
		const nextIndex = (currentIndex + 1) % data.artist.artworks.length;
		const nextArtworkId = data.artist.artworks[nextIndex].id;
		goto(`/artist/${data.artist.id}/${nextArtworkId}`).then(() => {
			restoreFocus();
		});
	}

	function prevArtwork() {
		if (!data.artist) return;
		const prevIndex = (currentIndex - 1 + data.artist.artworks.length) % data.artist.artworks.length;
		const prevArtworkId = data.artist.artworks[prevIndex].id;
		goto(`/artist/${data.artist.id}/${prevArtworkId}`).then(() => {
			restoreFocus();
		});
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Prevent default behavior for our handled keys
		const handledKeys = ['Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'KeyF', 'KeyH', 'Space', 'Home', 'End'];
		if (handledKeys.includes(event.code)) {
			event.preventDefault();
		}

		// Don't handle keys if user is typing in an input field
		const activeElement = document.activeElement;
		if (activeElement && (
			activeElement.tagName === 'INPUT' || 
			activeElement.tagName === 'TEXTAREA' || 
			(activeElement as HTMLElement).contentEditable === 'true'
		)) {
			return;
		}

		switch (event.key) {
			case 'Escape':
				if (keyboardHelpVisible) {
					keyboardHelpVisible = false;
				} else if (isInBrowserFullscreen) {
					// Exit fullscreen if in fullscreen mode
					document.exitFullscreen?.();
				} else {
					closeOverlay();
				}
				break;
			
			case 'ArrowRight':
			case 'ArrowDown':
				nextArtwork();
				break;
			
			case 'ArrowLeft':
			case 'ArrowUp':
				prevArtwork();
				break;
			
			case 'f':
			case 'F':
				// Toggle fullscreen for images and iframes
				if (currentArtworkForDisplay && !isInBrowserFullscreen) {
					const artworkContainer = document.querySelector('.artwork-container');
					if (artworkContainer && artworkContainer.requestFullscreen) {
						artworkContainer.requestFullscreen();
					}
				} else if (isInBrowserFullscreen) {
					document.exitFullscreen?.();
				}
				break;
			
			case ' ':
				// Space bar - toggle play/pause for videos or next artwork for images
				const videoElement = document.querySelector('video');
				if (videoElement) {
					if (videoElement.paused) {
						videoElement.play();
					} else {
						videoElement.pause();
					}
				} else {
					nextArtwork();
				}
				break;
			
			case 'Home':
				// Go to first artwork
				if (data.artist && data.artist.artworks.length > 0) {
					const firstArtworkId = data.artist.artworks[0].id;
					goto(`/artist/${data.artist.id}/${firstArtworkId}`).then(() => {
						restoreFocus();
					});
				}
				break;
			
			case 'End':
				// Go to last artwork
				if (data.artist && data.artist.artworks.length > 0) {
					const lastIndex = data.artist.artworks.length - 1;
					const lastArtworkId = data.artist.artworks[lastIndex].id;
					goto(`/artist/${data.artist.id}/${lastArtworkId}`).then(() => {
						restoreFocus();
					});
				}
				break;
			
			case 'h':
			case 'H':
			case '?':
				// Toggle keyboard help
				keyboardHelpVisible = !keyboardHelpVisible;
				break;
			
			case 'b':
			case 'B':
				// Go back to artist page
				if (data.artist) {
					goto(`/artist/${data.artist.id}`);
				}
				break;
		}
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

	$: pageTitle = data.artist && currentArtwork
		? `${currentArtwork.title} by ${data.artist.name} | Wallace Museum`
		: data.error
			? 'Artwork Not Found | Wallace Museum'
			: 'Loading Artwork | Wallace Museum';

	// Transform artwork data to match ArtworkDisplay component interface
	$: currentArtworkForDisplay = currentArtwork ? {
		generatorUrl: currentArtwork.generator_url || currentArtwork.generatorUrl,
		animationUrl: currentArtwork.animation_url || currentArtwork.animationUrl,
		imageUrl: currentArtwork.image_url || currentArtwork.imageUrl,
		thumbnailUrl: currentArtwork.thumbnail_url || currentArtwork.thumbnailUrl,
		mime: currentArtwork.mime,
		title: currentArtwork.title,
		dimensions: dimensionsObj,
		fullscreen: currentArtwork.fullscreen
	} : null;

	let width: number = dimensionsObj?.width ?? 0;
	let height: number = dimensionsObj?.height ?? 0;

	$: if (dimensionsObj) {
		width = dimensionsObj.width ?? 0;
		height = dimensionsObj.height ?? 0;
	}

	// Update currentIndex when data changes (for URL navigation)
	$: if (data.currentIndex !== undefined && data.currentIndex !== currentIndex) {
		currentIndex = data.currentIndex;
		restoreFocus();
	}

	// Restore focus when artwork changes
	$: if (currentArtwork && mainContainer) {
		restoreFocus();
	}

	// Check if current artwork is fullscreen
	$: isFullscreen = currentArtwork?.fullscreen || false;
	$: hasValidDimensions = dimensionsObj && dimensionsObj.width > 0 && dimensionsObj.height > 0;
	$: useExactDimensions = hasValidDimensions && !isFullscreen;

	// Temporary debug log to verify dimensions
	$: if (currentArtworkForDisplay && dimensionsObj) {
		console.log('✅ Dimensions check:', {
			dimensionsObj,
			hasValidDimensions,
			useExactDimensions,
			isFullscreen,
			aspectRatio
		});
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content={data.artist && currentArtwork
			? `${currentArtwork.title} by ${data.artist.name} at the Wallace Museum`
			: 'Artwork gallery at the Wallace Museum'}
	/>
</svelte:head>

{#if !data.artist && data.error}
	<div class="artist-page" transition:fade>
		<div class="artist-content">
			<button class="close-button" on:click={closeOverlay} aria-label="Close artist gallery"
				>×</button
			>
			<h2 class="artist-overlay-title">Artwork Not Found</h2>
			<p class="text-gray-300 mb-4">{data.error}</p>
		</div>
	</div>
{:else if !data.artist}
	<div class="artist-page" transition:fade>
		<div class="artist-content">
			<div class="flex flex-col items-center justify-center min-h-[200px]">
				<div class="loader mb-4" />
				<p class="text-gray-300">Loading artwork...</p>
			</div>
		</div>
	</div>
{:else}
	<div class="artist-page" role="application" tabindex="0" on:keydown={handleKeyDown} on:click={() => mainContainer?.focus()} transition:fade bind:this={mainContainer}>
		<!-- Small header with museum name -->
		<header class="museum-header-nav">
			<button class="museum-name-link" on:click={() => goto('/')} aria-label="Return to homepage">
				The Wallace Museum
			</button>
			
			<!-- Keyboard navigation indicator -->
			<div class="keyboard-indicator">
				<button 
					class="keyboard-help-trigger"
					on:click={() => keyboardHelpVisible = true}
					aria-label="Show keyboard shortcuts"
					title="Press H for keyboard shortcuts"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
						<line x1="8" y1="21" x2="16" y2="21"/>
						<line x1="12" y1="17" x2="12" y2="21"/>
					</svg>
					<span class="keyboard-help-text">Press H for shortcuts</span>
				</button>
			</div>
		</header>

		{#if data.artist.artworks.length > 0 && currentArtwork}
			{#key currentIndex}
				<div class="museum-content">
					{#if currentArtworkForDisplay}
					<div class="artwork-container" class:fullscreen={isFullscreen}>
						<ArtworkDisplay 
							artwork={currentArtworkForDisplay}
							dimensions={currentArtworkForDisplay.dimensions}
							fullscreen={isFullscreen}
						/>
					</div>
					{/if}

					<div class="museum-details-wrapper">
						<div class="museum-details-overlay">
							<div class="museum-header">
								<div class="museum-artist-title">
									<div class="museum-artist">
										<button 
											class="artist-back-button"
											on:click={() => goto(`/artist/${data.artist.id}`)}
											aria-label="Back to artist profile (B)"
											title="Back to artist profile (B)"
										>
											<svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="m15 18-6-6 6-6"/>
											</svg>
											<span class="artist-name">{data.artist.name}</span>
										</button>
									</div>
									<div class="museum-title">{currentArtwork.title}</div>
								</div>

								{#if data.artist.artworks.length > 1}
									<div class="artwork-navigation">
										<button 
											class="nav-button" 
											on:click={prevArtwork} 
											aria-label="Previous artwork (← or ↑)"
											title="Previous artwork (← or ↑)"
										>
											←
										</button>
										<button 
											class="nav-button" 
											on:click={nextArtwork} 
											aria-label="Next artwork (→ or ↓)"
											title="Next artwork (→ or ↓)"
										>
											→
										</button>
									</div>
								{/if}
							</div>

							<div class="content-grid">
								{#if currentArtwork.description}
									<div class="description-col">
										<div class="museum-description">
											{currentArtwork.description}
										</div>
									</div>
								{/if}

								<div class="metadata-col">
									{#if currentArtwork.attributes && currentArtwork.attributes.length}
										<div class="metadata-section">
											<h3 class="metadata-heading">Attributes</h3>
											<div class="metadata-grid">
												{#each parseAttributes(currentArtwork.attributes) as attribute}
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
											{#if currentArtwork.supply}
												<div class="metadata-item">
													<strong>Edition</strong>
													<span>1 of {currentArtwork.supply}</span>
												</div>
											{/if}
											{#if currentDimensions}
												<div class="metadata-item">
													<strong>Dimensions</strong>
													<span>{dimensionsObj.width} × {dimensionsObj.height}</span>
												</div>
											{/if}
											{#if currentArtwork.contractAddr}
												<div class="metadata-item">
													<strong>Contract</strong>
													{#if getContractUrl(currentArtwork.contractAddr, currentArtwork.blockchain, currentArtwork.tokenID)}
														<a
															href={getContractUrl(
																currentArtwork.contractAddr,
																currentArtwork.blockchain,
																currentArtwork.tokenID
															)}
															target="_blank"
															rel="noopener noreferrer"
															class="contract-link"
														>
															{getContractName(
																currentArtwork.contractAddr,
																currentArtwork.contractAlias
															)}
														</a>
													{:else}
														<span>
															{getContractName(
																currentArtwork.contractAddr,
																currentArtwork.contractAlias
															)}
														</span>
													{/if}
												</div>
											{/if}
											{#if currentArtwork.contractAlias && !currentArtwork.contractAddr}
												<div class="metadata-item">
													<strong>Contract Alias</strong>
													<span>{currentArtwork.contractAlias}</span>
												</div>
											{/if}
											{#if currentArtwork.tokenID}
												<div class="metadata-item">
													<strong>Token ID</strong>
													<span>{currentArtwork.tokenID}</span>
												</div>
											{/if}
											{#if currentArtwork.tokenStandard}
												<div class="metadata-item">
													<strong>Token Standard</strong>
													<span>{currentArtwork.tokenStandard?.toUpperCase()}</span>
												</div>
											{/if}

											{#if currentArtwork.mintDate}
												<div class="metadata-item">
													<strong>Mint Date</strong>
													<span>{formatMintDate(currentArtwork.mintDate)}</span>
												</div>
											{/if}
											{#if currentArtwork.mime}
												<div class="metadata-item">
													<strong>Medium</strong>
													<span>{formatMedium(currentArtwork.mime)}</span>
												</div>
											{/if}
											{#if currentArtwork.tags && currentArtwork.tags.length}
												<div class="metadata-item">
													<strong>Tags</strong>
													<span>{parseAndJoinTags(currentArtwork.tags)}</span>
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

		<!-- Keyboard Help Overlay -->
		{#if keyboardHelpVisible}
			<div class="keyboard-help-overlay" transition:fade>
				<div class="keyboard-help-content">
					<div class="keyboard-help-header">
						<h3>Keyboard Shortcuts</h3>
						<button 
							class="help-close-button"
							on:click={() => keyboardHelpVisible = false}
							aria-label="Close keyboard help"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>
					
					<div class="keyboard-help-grid">
						<div class="help-section">
							<h4>Navigation</h4>
							<div class="help-item">
								<kbd>←</kbd><kbd>↑</kbd>
								<span>Previous artwork</span>
							</div>
							<div class="help-item">
								<kbd>→</kbd><kbd>↓</kbd>
								<span>Next artwork</span>
							</div>
							<div class="help-item">
								<kbd>Home</kbd>
								<span>First artwork</span>
							</div>
							<div class="help-item">
								<kbd>End</kbd>
								<span>Last artwork</span>
							</div>
							<div class="help-item">
								<kbd>B</kbd>
								<span>Back to artist</span>
							</div>
						</div>

						<div class="help-section">
							<h4>Display</h4>
							<div class="help-item">
								<kbd>F</kbd>
								<span>Toggle fullscreen</span>
							</div>
							<div class="help-item">
								<kbd>Space</kbd>
								<span>Play/pause video or next artwork</span>
							</div>
							<div class="help-item">
								<kbd>Esc</kbd>
								<span>Exit fullscreen or close</span>
							</div>
						</div>

						<div class="help-section">
							<h4>Help</h4>
							<div class="help-item">
								<kbd>H</kbd><kbd>?</kbd>
								<span>Show/hide this help</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Fullscreen Navigation Hint -->
		{#if fullscreenHintVisible && isInBrowserFullscreen}
			<div class="fullscreen-hint" transition:fade>
				<div class="fullscreen-hint-content">
					<p>Use ← → arrow keys to navigate • Press H for help • Press Esc to exit</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.artist-page {
		@apply w-full min-h-screen bg-black bg-opacity-80;
		outline: none;
	}

	.artist-page:focus {
		outline: 2px solid transparent;
	}

	.museum-content {
		@apply flex flex-col w-full items-center justify-start;
	}

	.artwork-container {
		@apply flex items-center justify-center bg-black bg-opacity-50 md:pt-0 md:pb-4;
		width: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Apply fixed height only on medium screens and up */
	@media (min-width: 1024px) {
		.artwork-container {
			height: 82svh;
		}
	}

	.artwork-container.fullscreen {
		@apply bg-black p-0;
		width: 100vw;
		height: 82svh;
		max-width: 100vw;
		max-height: 82svh;
		border-radius: 0;
		margin-left: calc(-50vw + 50%);
		margin-right: calc(-50vw + 50%);
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
		@apply flex-1 pr-4 min-w-0;
	}

	.museum-artist {
		@apply text-sm font-medium uppercase tracking-wider text-yellow-500 mb-1;
	}

	.museum-title {
		@apply text-lg font-bold text-white leading-tight uppercase;
	}

	.artwork-navigation {
		@apply flex items-center gap-2 ml-4 flex-shrink-0;
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

	.museum-header-nav {
		@apply bg-black bg-opacity-50 w-full p-4 flex items-center justify-between relative;
	}

	.museum-name-link {
		@apply m-0 p-0 text-yellow-500 text-sm font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-yellow-400 transition-colors duration-200 focus:text-yellow-400 focus:outline-none;
	}

	.artist-back-button {
		@apply flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors;
		@apply bg-transparent border-none cursor-pointer p-0 m-0 min-w-0;
		text-decoration: none;
		
		&:hover {
			.back-icon {
				transform: translateX(-2px);
			}
		}
	}

	.back-icon {
		@apply w-4 h-4 transition-transform duration-200 flex-shrink-0;
	}

	.artist-name {
		@apply text-sm font-medium uppercase tracking-wider;
	}

	.keyboard-help-overlay {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
	}

	.keyboard-help-content {
		@apply bg-white dark:bg-gray-950 p-8 rounded-lg shadow-xl max-w-2xl max-h-[80vh] overflow-y-auto;
	}

	.keyboard-help-header {
		@apply flex justify-between items-center mb-6;
	}

	.keyboard-help-header h3 {
		@apply text-lg font-bold text-gray-900 dark:text-white;
	}

	.help-close-button {
		@apply relative -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-950 text-gray-500 dark:text-white rounded-full hover:bg-gray-300 dark:hover:bg-gray-800 transition-colors;
	}

	.keyboard-help-grid {
		@apply grid grid-cols-1 md:grid-cols-3 gap-6;
	}

	.help-section {
		@apply flex flex-col gap-3;
	}

	.help-section h4 {
		@apply text-base font-semibold text-gray-800 dark:text-gray-200 mb-2;
	}

	.help-item {
		@apply flex items-center gap-3;
	}

	.help-item kbd {
		@apply inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-mono rounded-md border border-gray-300 dark:border-gray-600 min-w-[2rem] justify-center;
	}

	.help-item span {
		@apply text-sm text-gray-700 dark:text-gray-300;
	}

	.keyboard-indicator {
		/* Remove left margin since it's now positioned on the right */
		
		/* Hide on smaller screens (mobile/tablet) */
		@media (max-width: 1023px) {
			display: none;
		}
		
		/* Hide on touch devices */
		@media (hover: none) and (pointer: coarse) {
			display: none;
		}
		
		/* Hide on devices that don't support hover */
		@media (hover: none) {
			display: none;
		}
	}

	.keyboard-help-trigger {
		@apply flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors;
		@apply bg-transparent border-none cursor-pointer p-0 m-0;
	}

	.keyboard-help-text {
		@apply text-sm font-medium;
	}

	.fullscreen-hint {
		@apply fixed top-4 left-1/2 transform -translate-x-1/2 z-50;
	}

	.fullscreen-hint-content {
		@apply bg-black bg-opacity-80 text-white px-4 py-2 rounded-lg shadow-lg;
	}

	.fullscreen-hint-content p {
		@apply text-sm font-medium m-0;
	}
</style> 